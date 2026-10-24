import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import * as XLSX from 'xlsx';
import {seed} from '../lib/seed';
import {buildPaymentExport,createPaymentWorkbook} from '../lib/payment-export';
import {createPaymentLedgerPdf} from '../lib/payment-ledger-pdf';

test('Excel export preserves the displayed subset, date order, decimals, and text without modifying payments',()=>{
 const db=seed(),before=JSON.stringify(db);
 const selected=[{...db.payments[0],id:'one',date:'2026-10-23',amount:170.5,notes:'=SUM(A1:A2)'},{...db.payments[0],id:'two',date:'2026-10-24',amount:0.2,reference:'Second'}];
 const data=buildPaymentExport(db,selected,'Hybrid DD','2026-10-24');
 assert.equal(data.rows.length,2);assert.equal(data.rows[0]['Payment ID'],'two');assert.equal(data.total,170.7);
 const book=createPaymentWorkbook(data);
 const reopened=XLSX.read(XLSX.write(book,{type:'buffer',bookType:'xlsx'}),{type:'buffer'});
 const sheet=reopened.Sheets.Payments;
 assert.equal(sheet.B3.v,'Hybrid DD');assert.equal(sheet.B5.v,2);assert.equal(sheet.D5.v,170.7);
 assert.equal(sheet.D8.t,'n');assert.equal(sheet.D8.v,0.2);assert.equal(sheet.D9.v,170.5);
 assert.equal(sheet.I9.v,'=SUM(A1:A2)');assert.equal(sheet.I9.f,undefined);
 assert.equal(sheet['!autofilter']?.ref,'A7:K9');
 assert.equal(JSON.stringify(db),before);
});

test('payment ledger PDFs wrap long records and repeat headers without crossing page boundaries',async()=>{
 const canvas=await import('@napi-rs/canvas');
 Object.assign(globalThis,{DOMMatrix:canvas.DOMMatrix,ImageData:canvas.ImageData,Path2D:canvas.Path2D});
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const db=seed();
 const rows=Array.from({length:18},(_,i)=>({...db.payments[0],id:`export-${i}`,amount:170.5,reference:`BANK-REFERENCE-${i}`,notes:'Payment notes with a long description for pagination review. '.repeat(i===17?70:2)}));
 const data=buildPaymentExport(db,rows,'Hybrid DD','2026-10-24');
 const pdf=createPaymentLedgerPdf(data,{regular:readFileSync('public/fonts/google-sans-400.ttf').toString('base64'),bold:readFileSync('public/fonts/google-sans-700.ttf').toString('base64')});
 const task=getDocument({data:new Uint8Array(pdf.output('arraybuffer')),useSystemFonts:false});
 try{
  const document=await task.promise;assert.ok(document.numPages>1);
  let text='';
  for(let index=1;index<=document.numPages;index++){
   const page=await document.getPage(index),viewport=page.getViewport({scale:1});
   const content=await page.getTextContent();
   for(const item of content.items){
    if(!('str' in item)||!item.str.trim())continue;text+=item.str+'\n';
    assert.ok(item.transform[4]>=30&&item.transform[4]+item.width<=viewport.width-28,`Text crosses page sides: ${item.str}`);
    assert.ok(item.transform[5]>=16&&item.transform[5]<=viewport.height-16,`Text crosses page height: ${item.str}`);
   }
   if(index===1||index===document.numPages){
    const view=page.getViewport({scale:1.25}),surface=canvas.createCanvas(Math.ceil(view.width),Math.ceil(view.height));
    await page.render({canvas:surface as never,canvasContext:surface.getContext('2d') as never,viewport:view}).promise;
    mkdirSync('tmp/pdfs',{recursive:true});writeFileSync(`tmp/pdfs/payment-ledger-${index===1?'first':'last'}.png`,surface.toBuffer('image/png'));
   }
  }
  assert.match(text,/Hybrid DD/);assert.match(text,/170\.50/);assert.ok(text.replace(/\s/g,'').includes('BANK-REFERENCE-17'),JSON.stringify(text.match(/BANK[^\n]*(?:\n[^\n]*){0,3}/g)));
  assert.equal(text.match(/MEMBER\n/g)?.length,document.numPages);
  assert.match(pdf.output(),/GoogleSans/);
 }finally{await task.destroy();}
});
