/**
 * Split a workbook into one file per sheet by editing the OOXML package directly.
 *
 * Instead of parsing and re-serialising cell data (which loses charts, images,
 * conditional formatting, ...), each output is the original zip with every other
 * sheet removed from workbook.xml / rels / [Content_Types].xml. Everything that
 * belongs to the kept sheet stays byte-for-byte identical.
 *
 * Known limitations:
 * - Formulas that reference removed sheets become #REF! after recalculation.
 * - Parts used only by removed sheets (drawings, charts, ...) stay in the zip as
 *   unreferenced orphans. Excel ignores them; they only cost some bytes.
 *
 * DOMParser is not available in Web Workers, so this uses targeted regexes.
 * workbook.xml and rels files are small and machine-generated, which keeps it safe.
 */
import JSZip from 'jszip';
import { baseName, extName, sanitizeFileName } from './names';

export interface SheetInfo {
  index: number;
  name: string;
  hidden: boolean;
}

interface SheetEntry extends SheetInfo {
  xml: string; // the full <sheet .../> element
  rId: string;
  path: string; // zip path, e.g. xl/worksheets/sheet1.xml
}

export interface OutputFile {
  name: string;
  data: Uint8Array;
}

const WORKBOOK = 'xl/workbook.xml';
const WORKBOOK_RELS = 'xl/_rels/workbook.xml.rels';
const CONTENT_TYPES = '[Content_Types].xml';

const SHEET_RE = /<(?:\w+:)?sheet\b[^>]*?(?:\/>|>\s*<\/(?:\w+:)?sheet>)/g;
const DEFINED_NAME_RE =
  /<(?:\w+:)?definedName\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?definedName>/g;
const RELATIONSHIP_RE = /<Relationship\b[^>]*?\/>/g;

function attr(xml: string, name: string): string | undefined {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(xml);
  return m ? decodeXml(m[1]) : undefined;
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&');
}

/** Resolve a relationship Target (relative to xl/) to a zip path. */
function resolveTarget(target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const parts = ['xl'];
  for (const seg of target.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg && seg !== '.') parts.push(seg);
  }
  return parts.join('/');
}

function relsPathFor(partPath: string): string {
  const i = partPath.lastIndexOf('/');
  return `${partPath.slice(0, i)}/_rels/${partPath.slice(i + 1)}.rels`;
}

async function readText(zip: JSZip, path: string): Promise<string> {
  const file = zip.file(path);
  if (!file) throw new Error(`Invalid file: missing ${path}`);
  return file.async('string');
}

async function readSheets(zip: JSZip): Promise<SheetEntry[]> {
  const workbook = await readText(zip, WORKBOOK);
  const rels = await readText(zip, WORKBOOK_RELS);

  const targets = new Map<string, string>();
  for (const rel of rels.match(RELATIONSHIP_RE) ?? []) {
    const id = attr(rel, 'Id');
    const target = attr(rel, 'Target');
    if (id && target) targets.set(id, resolveTarget(target));
  }

  return (workbook.match(SHEET_RE) ?? []).map((xml, index) => {
    // r:id — the prefix is usually "r" but any prefix is legal.
    const rId = /\s\w+:id="([^"]*)"/.exec(xml)?.[1] ?? '';
    const state = attr(xml, 'state');
    return {
      index,
      xml,
      rId,
      name: attr(xml, 'name') ?? `Sheet${index + 1}`,
      hidden: state === 'hidden' || state === 'veryHidden',
      path: targets.get(rId) ?? '',
    };
  });
}

export async function listSheets(data: ArrayBuffer | Uint8Array): Promise<SheetInfo[]> {
  const zip = await JSZip.loadAsync(data);
  return (await readSheets(zip)).map(({ index, name, hidden }) => ({ index, name, hidden }));
}

function referencesSheet(formula: string, sheetName: string): boolean {
  const quoted = `'${sheetName.replace(/'/g, "''")}'!`;
  return formula.includes(quoted) || formula.includes(`${sheetName}!`);
}

/** Return a new package containing only the sheet at `keepIndex`. */
export async function extractSheet(
  data: ArrayBuffer | Uint8Array,
  keepIndex: number,
): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(data);
  const sheets = await readSheets(zip);
  const kept = sheets[keepIndex];
  if (!kept) throw new Error(`Sheet #${keepIndex + 1} does not exist`);
  const removed = sheets.filter((s) => s !== kept);
  const removedIds = new Set(removed.map((s) => s.rId));
  const removedParts = new Set(removed.map((s) => s.path));

  // --- workbook.xml -------------------------------------------------------
  let workbook = await readText(zip, WORKBOOK);
  for (const s of removed) workbook = workbook.replace(s.xml, '');
  // A workbook needs at least one visible sheet.
  workbook = workbook.replace(kept.xml, kept.xml.replace(/\sstate="[^"]*"/, ''));
  workbook = workbook
    .replace(/(\sactiveTab=")\d+"/g, '$10"')
    .replace(/(\sfirstSheet=")\d+"/g, '$10"');

  workbook = workbook.replace(DEFINED_NAME_RE, (whole, attrs: string, formula: string) => {
    const local = /\slocalSheetId="(\d+)"/.exec(attrs);
    if (local) {
      if (Number(local[1]) !== keepIndex) return '';
      return whole.replace(/(\slocalSheetId=")\d+"/, '$10"');
    }
    const name = decodeXml(formula);
    return removed.some((s) => referencesSheet(name, s.name)) ? '' : whole;
  });
  // <definedNames> must not be empty.
  workbook = workbook.replace(/<(\w+:)?definedNames>\s*<\/(\w+:)?definedNames>/, '');
  zip.file(WORKBOOK, workbook);

  // --- workbook.xml.rels ----------------------------------------------------
  // calcChain.xml points at cells of every sheet; Excel rebuilds it if missing,
  // but reports corruption if it references sheets that no longer exist.
  let calcChainPath: string | undefined;
  const rels = (await readText(zip, WORKBOOK_RELS)).replace(RELATIONSHIP_RE, (rel) => {
    const id = attr(rel, 'Id') ?? '';
    if (removedIds.has(id)) return '';
    if ((attr(rel, 'Type') ?? '').endsWith('/calcChain')) {
      calcChainPath = resolveTarget(attr(rel, 'Target') ?? '');
      return '';
    }
    return rel;
  });
  zip.file(WORKBOOK_RELS, rels);

  // --- remove parts ---------------------------------------------------------
  if (calcChainPath) removedParts.add(calcChainPath);
  for (const part of removedParts) {
    zip.remove(part);
    zip.remove(relsPathFor(part));
  }

  // --- [Content_Types].xml -------------------------------------------------
  const contentTypes = (await readText(zip, CONTENT_TYPES)).replace(
    /<Override\b[^>]*?\/>/g,
    (o) => (removedParts.has((attr(o, 'PartName') ?? '').replace(/^\//, '')) ? '' : o),
  );
  zip.file(CONTENT_TYPES, contentTypes);

  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

/**
 * Split `fileName` into one file per selected sheet.
 * The original extension is kept (.xlsm stays .xlsm because macros are preserved).
 */
export async function splitWorkbook(
  fileName: string,
  data: ArrayBuffer | Uint8Array,
  indices?: number[],
  onProgress?: (done: number, total: number) => void,
): Promise<OutputFile[]> {
  const sheets = await listSheets(data);
  const selected = indices ?? sheets.map((s) => s.index);
  const base = baseName(fileName);
  const ext = extName(fileName) || '.xlsx';
  const usedNames = new Set<string>();
  const out: OutputFile[] = [];

  for (const [i, index] of selected.entries()) {
    let name = sanitizeFileName(`${base} - ${sheets[index].name}`);
    for (let n = 2; usedNames.has(name.toLowerCase()); n++) name = `${name} (${n})`;
    usedNames.add(name.toLowerCase());
    out.push({ name: name + ext, data: await extractSheet(data, index) });
    onProgress?.(i + 1, selected.length);
  }
  return out;
}

export async function zipFiles(files: OutputFile[]): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const f of files) zip.file(f.name, f.data);
  return zip.generateAsync({ type: 'uint8array', compression: 'STORE' }); // xlsx is already compressed
}
