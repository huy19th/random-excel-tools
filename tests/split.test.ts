import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { extractSheet, listSheets, splitWorkbook, zipFiles } from '../src/lib/split';
import { load, makeWorkbook } from './fixtures';

describe('listSheets', () => {
  it('returns names, order and hidden state', async () => {
    const sheets = await listSheets(await makeWorkbook());
    expect(sheets).toEqual([
      { index: 0, name: 'Data', hidden: false },
      { index: 1, name: 'Summary', hidden: false },
      { index: 2, name: 'Hidden', hidden: true },
    ]);
  });

  it('decodes XML entities in sheet names', async () => {
    const sheets = await listSheets(await makeWorkbook(['A & B', 'x<y']));
    expect(sheets.map((s) => s.name)).toEqual(['A & B', 'x<y']);
  });
});

describe('extractSheet', () => {
  it('keeps only the chosen sheet with its formatting', async () => {
    const wb = await load(await extractSheet(await makeWorkbook(), 1));
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Summary']);
    const ws = wb.worksheets[0];
    expect(ws.getCell('A1').value).toBe('Summary title');
    expect(ws.getCell('A1').font?.bold).toBe(true);
    expect(ws.getCell('C1').isMerged).toBe(true);
    expect(ws.getCell('B2').formula).toBe('A2*2');
    expect(ws.getColumn(1).width).toBe(25);
    expect(ws.getRow(2).height).toBe(30);
  });

  it('removes the parts of other sheets from the package', async () => {
    const zip = await JSZip.loadAsync(await extractSheet(await makeWorkbook(), 1));
    const sheetFiles = Object.keys(zip.files).filter((p) => /^xl\/worksheets\/[^/]+\.xml$/.test(p));
    expect(sheetFiles).toHaveLength(1);
    const types = await zip.file('[Content_Types].xml')!.async('string');
    expect(types.match(/worksheets\/sheet\d+\.xml/g)).toHaveLength(1);
  });

  it('makes a hidden sheet visible', async () => {
    const wb = await load(await extractSheet(await makeWorkbook(), 2));
    expect(wb.worksheets[0].state).toBe('visible');
  });

  it('drops defined names that point at removed sheets', async () => {
    const kept = await load(await extractSheet(await makeWorkbook(), 0));
    expect(kept.definedNames.getRanges('FirstValue').ranges).toHaveLength(1);
    const dropped = await load(await extractSheet(await makeWorkbook(), 1));
    expect(dropped.definedNames.getRanges('FirstValue').ranges).toHaveLength(0);
  });
});

describe('splitWorkbook', () => {
  it('names files after the source and sheet, keeping the extension', async () => {
    const files = await splitWorkbook('report.xlsm', await makeWorkbook(), [0, 1]);
    expect(files.map((f) => f.name)).toEqual(['report - Data.xlsm', 'report - Summary.xlsm']);
  });

  it('zips the outputs', async () => {
    const files = await splitWorkbook('r.xlsx', await makeWorkbook());
    const zip = await JSZip.loadAsync(await zipFiles(files));
    expect(Object.keys(zip.files)).toHaveLength(3);
  });
});
