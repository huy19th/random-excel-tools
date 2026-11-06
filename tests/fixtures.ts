import ExcelJS from 'exceljs';

/** Build a workbook with styles, merges, a formula, a defined name and a hidden sheet. */
export async function makeWorkbook(sheetNames = ['Data', 'Summary', 'Hidden']): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  for (const [i, name] of sheetNames.entries()) {
    const ws = wb.addWorksheet(name, { state: name === 'Hidden' ? 'hidden' : 'visible' });
    ws.getColumn(1).width = 25;
    ws.getCell('A1').value = `${name} title`;
    ws.getCell('A1').font = { bold: true, color: { argb: 'FFFF0000' } };
    ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
    ws.mergeCells('A1:C1');
    ws.getCell('A2').value = i + 1;
    ws.getCell('B2').value = { formula: 'A2*2', result: (i + 1) * 2 };
    ws.getRow(2).height = 30;
  }
  wb.definedNames.add(`'${sheetNames[0]}'!$A$2`, 'FirstValue');
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

export async function load(data: ArrayBuffer | Uint8Array): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data as ArrayBuffer);
  return wb;
}
