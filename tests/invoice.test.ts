import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { seed } from '../lib/seed';
import { buildInvoice, invoiceNumber } from '../lib/invoice';
import { createInvoicePdf } from '../lib/invoice-pdf';

test('invoice numbers preserve the payment date, weekday, and complete unique ID', () => {
 const payment = { id: 'payment-123', date: '2026-10-23' };
 assert.equal(invoiceNumber(payment), 'HYB-INV-20261023-FRI-payment-123');
 assert.equal(invoiceNumber({ ...payment }), invoiceNumber(payment));
 const ids = ['payment-123', 'payment-1234', 'PAYMENT-123', '/123', '%2F123', '_2F123'];
 assert.equal(new Set(ids.map(id => invoiceNumber({ ...payment, id }))).size, ids.length);
 assert.throws(() => invoiceNumber({ ...payment, date: '2026-02-30' }), /valid payment date/);
 assert.throws(() => invoiceNumber({ ...payment, id: '' }), /needs an ID/);
});

test('invoices use the recorded amount and status without changing payment data', () => {
 const db = seed(), before = JSON.stringify(db);
 const payment = { ...db.payments[0], amount: 75.5, status: 'Partial' };
 const invoice = buildInvoice(db, payment);
 assert.equal(invoice.amount, 75.5);
 assert.equal(invoice.status, 'Partial');
 assert.equal(invoice.memberName, db.members[0].name);
 assert.equal(invoice.company.phone, '019-699 3060');
 assert.equal(JSON.stringify(db), before);
 const archived = buildInvoice({ ...db, members: [], memberships: [], plans: [] }, payment);
 assert.equal(archived.memberId, payment.memberId);
 assert.equal(archived.description, 'Membership payment');
 assert.throws(() => buildInvoice(db, { ...payment, amount: NaN }), /valid amount/);
});

test('invoice PDFs preserve text, embed Google Sans, and paginate long notes inside the page', async () => {
 const canvas = await import('@napi-rs/canvas');
 Object.assign(globalThis, { DOMMatrix: canvas.DOMMatrix, ImageData: canvas.ImageData, Path2D: canvas.Path2D });
 const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
 const fonts = {
  regular: readFileSync('public/fonts/google-sans-400.ttf').toString('base64'),
  bold: readFileSync('public/fonts/google-sans-700.ttf').toString('base64'),
 };
 const db = seed();
 for (const long of [false, true]) {
  const invoice = buildInvoice(db, { ...db.payments[0], id: 'SAMPLE-payment-123', amount: 75.5, notes: long ? 'Membership payment note with details. '.repeat(200) : 'Thank you for training with us.' });
  const pdf = createInvoicePdf(invoice, fonts);
  const task = getDocument({ data: new Uint8Array(pdf.output('arraybuffer')), useSystemFonts: false });
 const document = await task.promise;
  assert.ok(long ? document.numPages > 1 : document.numPages === 1);
  let text = '';
  for (let pageNo = 1; pageNo <= document.numPages; pageNo++) {
   const page = await document.getPage(pageNo);
   const content = await page.getTextContent();
   const viewport = page.getViewport({ scale: 1 });
   for (const item of content.items) {
    if (!('str' in item) || !item.str.trim()) continue;
    text += item.str + '\n';
    assert.ok(item.transform[4] >= 35 && item.transform[4] + item.width <= viewport.width - 30, `Text crosses page sides: ${item.str}`);
    assert.ok(item.transform[5] >= 25 && item.transform[5] <= viewport.height - 25, `Text crosses page top or bottom: ${item.str}`);
   }
  }
  assert.ok(text.includes(invoice.number));
  assert.ok(text.includes(invoice.memberName));
  assert.ok(text.includes('RM 75.50'));
  assert.ok(text.includes('Thank you for being part of Hybrid.'));
  assert.match(pdf.output(), /GoogleSans/);
  await task.destroy();
 }
});
