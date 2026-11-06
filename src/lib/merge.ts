/**
 * Merge several workbooks into one by copying worksheets with ExcelJS.
 *
 * Copied: values, formulas, styles, merged cells, column widths, row heights,
 * hidden rows/columns, notes, data validation, conditional formatting,
 * auto filter, sheet view / page setup, images.
 * Not copied (ExcelJS limitation): charts, pivot tables, macros, slicers, form controls.
 */
import ExcelJS from 'exceljs';
import { baseName, uniqueSheetName } from './names';

export type NamingMode = 'sheet' | 'file' | 'file-sheet';

export interface MergeInput {
  name: string;
  data: ArrayBuffer;
  /** Indices of sheets to include. Omit to include all sheets. */
  sheets?: number[];
}

export interface MergeOptions {
  naming: NamingMode;
  onProgress?: (done: number, total: number) => void;
}

const clone = <T>(v: T): T => (v === undefined ? v : structuredClone(v));

function targetName(mode: NamingMode, file: string, sheet: string, sheetCount: number): string {
  const base = baseName(file);
  switch (mode) {
    case 'sheet':
      return sheet;
    case 'file':
      return sheetCount === 1 ? base : `${base}_${sheet}`;
    case 'file-sheet':
      return `${base}_${sheet}`;
  }
}

export async function mergeWorkbooks(
  inputs: MergeInput[],
  { naming, onProgress }: MergeOptions,
): Promise<ArrayBuffer> {
  const out = new ExcelJS.Workbook();
  const used = new Set<string>();

  for (const [i, input] of inputs.entries()) {
    const src = new ExcelJS.Workbook();
    await src.xlsx.load(input.data);
    const picked = src.worksheets.filter(
      (_, idx) => !input.sheets || input.sheets.includes(idx),
    );
    for (const ws of picked) {
      const name = uniqueSheetName(targetName(naming, input.name, ws.name, picked.length), used);
      copyWorksheet(src, ws, out, name);
    }
    onProgress?.(i + 1, inputs.length);
  }

  if (out.worksheets.length === 0) throw new Error('No sheets selected to merge');
  return out.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}

function copyWorksheet(
  srcWb: ExcelJS.Workbook,
  src: ExcelJS.Worksheet,
  outWb: ExcelJS.Workbook,
  name: string,
): void {
  const dst = outWb.addWorksheet(name, {
    properties: clone(src.properties),
    pageSetup: clone(src.pageSetup),
    headerFooter: clone(src.headerFooter),
    views: clone(src.views),
    state: src.state,
  });

  // Columns
  src.columns?.forEach((col, i) => {
    const d = dst.getColumn(i + 1);
    if (col.width !== undefined) d.width = col.width;
    if (col.hidden) d.hidden = true;
    if (col.outlineLevel) d.outlineLevel = col.outlineLevel;
    if (col.style && Object.keys(col.style).length) d.style = clone(col.style);
  });

  // Merges first, without style, so they don't overwrite the per-cell styles below.
  for (const range of src.model.merges ?? []) dst.mergeCellsWithoutStyle(range);

  // Rows and cells
  src.eachRow({ includeEmpty: true }, (row, r) => {
    const d = dst.getRow(r);
    if (row.height !== undefined) d.height = row.height;
    if (row.hidden) d.hidden = true;
    if (row.outlineLevel) d.outlineLevel = row.outlineLevel;
    row.eachCell({ includeEmpty: true }, (cell, c) => {
      const dc = d.getCell(c);
      if (cell.type !== ExcelJS.ValueType.Merge) dc.value = clone(cell.value);
      if (cell.style && Object.keys(cell.style).length) dc.style = clone(cell.style);
      if (cell.note) dc.note = clone(cell.note);
    });
  });

  // Sheet-level features (not all are in the public typings)
  const s = src as any;
  const d = dst as any;
  if (s.dataValidations?.model) d.dataValidations.model = clone(s.dataValidations.model);
  if (s.conditionalFormattings?.length) d.conditionalFormattings = clone(s.conditionalFormattings);
  if (src.autoFilter) dst.autoFilter = clone(src.autoFilter);

  // Images
  for (const img of src.getImages()) {
    try {
      const media = srcWb.getImage(Number(img.imageId));
      if (!media?.buffer) continue;
      const id = outWb.addImage({
        buffer: media.buffer,
        extension: media.extension as 'png' | 'jpeg' | 'gif',
      });
      const { tl, br, ext, editAs } = img.range as any;
      dst.addImage(id, {
        tl: { col: tl.col, row: tl.row },
        ...(br ? { br: { col: br.col, row: br.row } } : { ext }),
        editAs,
      } as any);
    } catch {
      // Skip images ExcelJS cannot round-trip rather than failing the whole merge.
    }
  }
}
