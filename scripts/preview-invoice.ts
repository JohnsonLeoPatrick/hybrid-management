import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createCanvas, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';
import { seed } from '../lib/seed';
import { buildInvoice } from '../lib/invoice';
import { createInvoicePdf } from '../lib/invoice-pdf';

async function main() {
 Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
 const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
 const db = seed();
 const invoice = buildInvoice(db, { ...db.payments[0], id: 'SAMPLE-20261023', date: '2026-10-23', amount: 170, reference: 'SAMPLE-TRANSFER-1040', notes: 'Boxing membership payment. This is a sample invoice for layout review.' });
 const pdf = createInvoicePdf(invoice, {
  regular: readFileSync('public/fonts/google-sans-400.ttf').toString('base64'),
  bold: readFileSync('public/fonts/google-sans-700.ttf').toString('base64'),
 });
 mkdirSync('tmp/pdfs', { recursive: true });
 writeFileSync('tmp/pdfs/sample-invoice.pdf', Buffer.from(pdf.output('arraybuffer')));
 const task = getDocument({ data: new Uint8Array(pdf.output('arraybuffer')) });
 const document = await task.promise;
 for (let pageNo = 1; pageNo <= document.numPages; pageNo++) {
  const page = await document.getPage(pageNo);
  const viewport = page.getViewport({ scale: 1.6 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  await page.render({ canvas: canvas as never, canvasContext: canvas.getContext('2d') as never, viewport }).promise;
  writeFileSync(`tmp/pdfs/sample-invoice-${pageNo}.png`, canvas.toBuffer('image/png'));
 }
 await task.destroy();
 console.log(`Rendered ${pdf.getNumberOfPages()} invoice page(s) to tmp/pdfs.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
