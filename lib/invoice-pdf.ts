import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { invoiceMoney, type InvoiceData } from './invoice';

export type InvoiceFonts = { regular: string; bold: string };
const ink = '#181818', muted = '#626262', line = '#e5e5e5';

export function createInvoicePdf(invoice: InvoiceData, fonts: InvoiceFonts) {
 const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
 doc.addFileToVFS('GoogleSans-Regular.ttf', fonts.regular);
 doc.addFont('GoogleSans-Regular.ttf', 'GoogleSans', 'normal');
 doc.addFileToVFS('GoogleSans-Bold.ttf', fonts.bold);
 doc.addFont('GoogleSans-Bold.ttf', 'GoogleSans', 'bold');
 doc.setFont('GoogleSans', 'normal');
 doc.setProperties({ title: `Invoice ${invoice.number}`, subject: 'Membership payment invoice', author: invoice.company.name, creator: invoice.company.name });
 const text = (value: string, x: number, y: number, size = 10, bold = false, color = ink, width?: number) => {
  doc.setFont('GoogleSans', bold ? 'bold' : 'normal');
  doc.setFontSize(size); doc.setTextColor(color);
  const lines: string[] = width ? doc.splitTextToSize(value, width) : [value];
  doc.text(lines, x, y, { lineHeightFactor: 1.5 });
  return y + lines.length * size * .3528 * 1.5;
 };
 doc.setFillColor('#f0c92c'); doc.rect(20, 19, 15, 2, 'F');
 text('HYBRID', 20, 34, 21, true);
 text('INVOICE', 148, 32, 24, true);
 let issuerY = text(invoice.company.name, 20, 43, 10, true, ink, 100);
 for (const address of invoice.company.address) issuerY = text(address, 20, issuerY + 1, 9, false, muted, 100);
 text(`${invoice.company.phone}  /  ${invoice.company.website}`, 20, issuerY + 3, 9, false, muted, 150);
 const numberY = Math.max(72, issuerY + 11);
 text('INVOICE NUMBER', 20, numberY, 8, true, muted);
 const numberBottom = text(invoice.number, 20, numberY + 7, 9, false, ink, 170);
 doc.setDrawColor(line); doc.line(20, numberBottom + 4, 190, numberBottom + 4);
 const detailY = numberBottom + 12;
 text('BILL TO', 20, detailY, 8, true, muted);
 let memberY = text(invoice.memberName, 20, detailY + 9, 13, true, ink, 95);
 for (const value of [invoice.memberId, invoice.memberAddress, invoice.memberEmail, invoice.memberPhone].filter(Boolean)) {
  memberY = text(value, 20, memberY + 2, 9, false, muted, 95);
 }
 let metaY = detailY;
 for (const [label, value] of [['Payment date', invoice.dateLabel], ['Payment status', invoice.status], ['Payment method', invoice.method], ...(invoice.branch ? [['Branch', invoice.branch]] : [])]) {
  text(label, 133, metaY, 8, false, muted, 57);
  metaY = text(value, 133, metaY + 4, 10, true, ink, 57) + 2;
 }
 autoTable(doc, {
  startY: Math.max(memberY, metaY) + 6,
  head: [['DESCRIPTION', { content: 'QTY', styles: { halign: 'center' } }, { content: 'AMOUNT', styles: { halign: 'right' } }]],
  body: [[`${invoice.description}${invoice.period ? `\nMembership period: ${invoice.period}` : ''}`, '1', invoiceMoney(invoice.amount)]],
  margin: { left: 20, right: 20, top: 22, bottom: 25 }, theme: 'plain',
  styles: { font: 'GoogleSans', fontSize: 10, textColor: ink, cellPadding: 5, overflow: 'linebreak', lineColor: line, lineWidth: { bottom: .2 } },
  headStyles: { fillColor: '#f6f6f6', textColor: muted, fontStyle: 'bold', fontSize: 8 },
  columnStyles: { 0: { cellWidth: 105 }, 1: { cellWidth: 20, halign: 'center' }, 2: { cellWidth: 45, halign: 'right' } },
 });
 let y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
 const ensureSpace = (height: number) => { if (y + height > 258) { doc.addPage(); y = 25; } };
 ensureSpace(27);
 doc.setFillColor('#f6f6f6'); doc.roundedRect(119, y - 5, 71, 22, 2, 2, 'F');
 text('Invoice total', 124, y + 2, 10, true);
 doc.setFont('GoogleSans', 'bold'); doc.setTextColor(ink); doc.setFontSize(15);
 doc.text(invoiceMoney(invoice.amount), 185, y + 11, { align: 'right' });
 y += 23;
 for (const [label, value] of [['PAYMENT REFERENCE', invoice.reference], ['NOTES', invoice.notes]]) {
  if (!value) continue;
  ensureSpace(22);
  y = text(label, 20, y, 8, true, muted) + 3;
  doc.setFont('GoogleSans', 'normal'); doc.setFontSize(9);
  const lines: string[] = doc.splitTextToSize(value, 170);
  for (const noteLine of lines) { ensureSpace(6); y = text(noteLine, 20, y, 9, false, muted); }
  y += 4;
 }
 const pages = doc.getNumberOfPages();
 for (let page = 1; page <= pages; page++) {
  doc.setPage(page); doc.setDrawColor(line); doc.line(20, 266, 190, 266);
  text('Thank you for being part of Hybrid.', 20, 273, 10, true);
  text('Reflects the recorded payment amount and status. No payment record is changed.', 20, 280, 8, false, muted, 170);
  text('HYBRID COMBATIVE ACADEMY & GYM', 20, 288, 8, false, muted);
  text(`${page} / ${pages}`, 179, 288, 8, false, muted);
 }
 return doc;
}

let fontCache: Promise<InvoiceFonts> | undefined;
export function loadInvoiceFonts() {
 if (!fontCache) fontCache = Promise.all([400, 700].map(async weight => {
  const response = await fetch(`/fonts/google-sans-${weight}.ttf`);
  if (!response.ok) throw new Error('Invoice font could not be loaded. Please try again.');
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(binary);
 })).then(([regular, bold]) => ({ regular, bold })).catch(error => { fontCache = undefined; throw error; });
 return fontCache;
}
