import {test} from 'node:test';
import assert from 'node:assert/strict';
import {invoiceEmailUrl} from '../lib/invoice-email';
import {buildInvoice} from '../lib/invoice';
import {seed} from '../lib/seed';
test('each invoice draft targets only the invoiced member and carries the correct invoice number',()=>{
 const db=seed();
 for(const payment of db.payments.slice(0,2)){
  const invoice=buildInvoice(db,payment),url=new URL(invoiceEmailUrl(invoice));
  assert.equal(url.searchParams.get('to'),db.members.find(m=>m.id===payment.memberId)!.email);
  assert.ok(url.searchParams.get('su')!.includes(invoice.number));
 }
 const invoice=buildInvoice(db,db.payments[0]);
 for(const email of ['', 'one@example.com,two@example.com','one@example.com\r\nBcc: other@example.com'])assert.throws(()=>invoiceEmailUrl({...invoice,memberEmail:email}));
});
