import { describe, expect, it } from 'vitest';
import { mergeWorkbooks } from '../src/lib/merge';
import { uniqueSheetName } from '../src/lib/names';
import { load, makeWorkbook } from './fixtures';

describe('mergeWorkbooks', () => {
  it('copies sheets in order with formatting', async () => {
    const out = await load(
      await mergeWorkbooks(
        [
          { name: 'a.xlsx', data: await makeWorkbook(['One', 'Two']) },
          { name: 'b.xlsx', data: await makeWorkbook(['Three']) },
        ],
        { naming: 'sheet' },
      ),
    );
    expect(out.worksheets.map((w) => w.name)).toEqual(['One', 'Two', 'Three']);
    const ws = out.getWorksheet('Two')!;
    expect(ws.getCell('A1').value).toBe('Two title');
    expect(ws.getCell('A1').font?.color?.argb).toBe('FFFF0000');
    expect(ws.getCell('C1').isMerged).toBe(true);
    expect(ws.getCell('B2').formula).toBe('A2*2');
    expect(ws.getColumn(1).width).toBe(25);
    expect(ws.getRow(2).height).toBe(30);
  });

  it('respects selected sheets and de-duplicates names', async () => {
    const data = () => makeWorkbook(['Data', 'Other']);
    const out = await load(
      await mergeWorkbooks(
        [
          { name: 'x.xlsx', data: await data(), sheets: [0] },
          { name: 'y.xlsx', data: await data(), sheets: [0] },
        ],
        { naming: 'sheet' },
      ),
    );
    expect(out.worksheets.map((w) => w.name)).toEqual(['Data', 'Data (2)']);
  });

  it('names by file', async () => {
    const out = await load(
      await mergeWorkbooks(
        [
          { name: 'jan.xlsx', data: await makeWorkbook(['S']) },
          { name: 'feb.xlsx', data: await makeWorkbook(['S', 'T']) },
        ],
        { naming: 'file' },
      ),
    );
    expect(out.worksheets.map((w) => w.name)).toEqual(['jan', 'feb_S', 'feb_T']);
  });
});

describe('uniqueSheetName', () => {
  it('sanitises and truncates to 31 chars', () => {
    const used = new Set<string>();
    expect(uniqueSheetName('a/b:c*d?', used)).toBe('a_b_c_d_');
    const long = 'x'.repeat(40);
    expect(uniqueSheetName(long, used)).toHaveLength(31);
    const second = uniqueSheetName(long, used);
    expect(second).toHaveLength(31);
    expect(second.endsWith(' (2)')).toBe(true);
  });
});
