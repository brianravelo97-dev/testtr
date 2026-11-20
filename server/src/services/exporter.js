import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { formatTs } from './format.js';

/**
 * columns: [{ header, key, width, format?(row) }]
 */
export async function toExcel(res, { title, sheet, columns, rows, filename }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Control de Acceso';
  wb.created = new Date();
  const ws = wb.addWorksheet(sheet || 'Datos', { views: [{ state: 'frozen', ySplit: 2 }] });
  ws.mergeCells(1, 1, 1, columns.length);
  ws.getCell(1, 1).value = title;
  ws.getCell(1, 1).font = { bold: true, size: 14 };
  ws.getRow(2).values = columns.map((c) => c.header);
  ws.getRow(2).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(2).eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } }; });
  columns.forEach((c, i) => { ws.getColumn(i + 1).width = c.width || 18; });
  for (const row of rows) ws.addRow(columns.map((c) => (c.format ? c.format(row) : row[c.key])));
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: columns.length } };
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
}

export function toPdf(res, { title, subtitle, columns, rows, filename, rowColor }) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30, bufferPages: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
  doc.pipe(res);

  const pageW = doc.page.width - 60;
  const totalW = columns.reduce((s, c) => s + (c.width || 18), 0);
  const widths = columns.map((c) => ((c.width || 18) / totalW) * pageW);

  doc.fontSize(16).font('Helvetica-Bold').text(title, { align: 'left' });
  doc.fontSize(9).font('Helvetica').fillColor('#555').text(subtitle || '', { align: 'left' });
  doc.moveDown(0.5);

  const drawHeader = () => {
    const y = doc.y;
    doc.rect(30, y, pageW, 18).fill('#1e40af');
    let x = 30;
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8);
    columns.forEach((c, i) => { doc.text(c.header, x + 3, y + 5, { width: widths[i] - 6, lineBreak: false, ellipsis: true }); x += widths[i]; });
    doc.y = y + 20;
  };
  drawHeader();
  doc.font('Helvetica').fontSize(7.5);
  rows.forEach((row, idx) => {
    if (doc.y > doc.page.height - 50) { doc.addPage(); drawHeader(); doc.font('Helvetica').fontSize(7.5); }
    const y = doc.y;
    if (idx % 2 === 0) doc.rect(30, y - 2, pageW, 14).fill('#f1f5f9');
    let x = 30;
    columns.forEach((c, i) => {
      const val = c.format ? c.format(row) : row[c.key];
      doc.fillColor((rowColor && rowColor(row, c)) || '#111').text(val == null ? '' : String(val), x + 3, y + 1, { width: widths[i] - 6, lineBreak: false, ellipsis: true });
      x += widths[i];
    });
    doc.y = y + 14;
  });
  if (rows.length === 0) doc.fillColor('#666').text('Sin registros para los filtros seleccionados.', 30, doc.y + 10);

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.fontSize(7).fillColor('#888').text(`Generado: ${formatTs(new Date())} — Página ${i + 1} de ${range.count}`, 30, doc.page.height - 25, { width: pageW, align: 'right', lineBreak: false });
  }
  doc.end();
}
