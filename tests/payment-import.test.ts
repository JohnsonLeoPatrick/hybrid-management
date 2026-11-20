import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyDatabase} from '../lib/workspace';
import {validatePaymentImport, type PaymentImportField} from '../lib/payment-import';
import * as XLSX from 'xlsx';
import {paymentEntryMethods} from '../lib/payment-methods';
import {today} from '../lib/utils';

function fixture(){
 const db=emptyDatabase();
 db.members.push({id:'HYB-DD-00001',name:'Member',branchId:'dd'} as typeof db.members[number]);
 db.memberships.push({id:'membership',memberId:'HYB-DD-00001',planId:'boxing'} as typeof db.memberships[number]);
 return db;
}
const mapping:Partial<Record<PaymentImportField,string>>={memberId:'Member',membershipId:'Membership',amount:'Amount',date:'Date',method:'Method',status:'Status',reference:'Reference',id:'ID'};
const row={Member:'HYB-DD-00001',Amount:'170.50',Date:today(),Method:'cash',Reference:'TRANSFER-001'};

test('new payment options are Cash and QR, while QR and historical ledger imports remain valid',()=>{
 assert.deepEqual(paymentEntryMethods,['Cash','QR']);
 for(const [input,expected] of [['qr','QR'],['cash','Cash'],['Online Transfer','Online Transfer']]){
  const result=validatePaymentImport([{...row,Method:input}],mapping,fixture())[0];
  assert.deepEqual(result.errors,[]);assert.equal(result.payment.method,expected);
 }
});
test('short member numbers resolve within the branch without attaching payments to a recycled former owner',()=>{
 const db=fixture();db.members[0].membershipNumber=null;
 db.members.push({...db.members[0],id:'new-owner',membershipNumber:1});
 db.memberships.push({...db.memberships[0],id:'new-membership',memberId:'new-owner'});
 const result=validatePaymentImport([{...row,Member:'01',Membership:'new-membership'}],mapping,db,'dd')[0];
 assert.deepEqual(result.errors,[]);assert.equal(result.payment.memberId,'new-owner');
 assert.ok(validatePaymentImport([{...row,Member:'01',Membership:'membership'}],mapping,db,'dd')[0].errors.length);
});
test('payment imports resolve a single membership and normalize method and default status',()=>{
 const result=validatePaymentImport([row],mapping,fixture(),'dd')[0];
 assert.deepEqual(result.errors,[]);
 assert.equal(result.payment.membershipId,'membership');
 assert.equal(result.payment.amount,170.5);
 assert.equal(result.payment.method,'Cash');assert.equal(result.payment.status,'Paid');
});
test('payment imports require an explicit membership when member history is ambiguous',()=>{
 const db=fixture();db.memberships.push({...db.memberships[0],id:'renewed'});
 assert.match(validatePaymentImport([row],mapping,db)[0].errors.join(),/Membership ID required/);
 assert.deepEqual(validatePaymentImport([{...row,Membership:'renewed'}],mapping,db)[0].errors,[]);
 assert.match(validatePaymentImport([{...row,Membership:'another-member'}],mapping,db)[0].errors.join(),/does not belong/);
});

test('payment import preview rejects a backdated payment before saving',()=>{
 const date=new Date(Date.parse(today())-86400000).toISOString().slice(0,10);
 assert.match(validatePaymentImport([{...row,Date:date}],mapping,fixture())[0].errors.join(),/before today/);
});
test('payment import rejects invalid dates, nonpositive amounts, excess decimals, methods, and branches',()=>{
 const changes:Record<string,string>[]=[{Date:'2026-02-30'},{Date:'10/24/2026'},{Amount:'0'},{Amount:'-1'},{Amount:'NaN'},{Amount:'1.001'},{Method:'Bitcoin'},{Status:'Unknown'},{Member:'Missing'}];
 for(const change of changes){
  assert.ok(validatePaymentImport([{...row,...change}],mapping,fixture())[0].errors.length);
 }
 assert.match(validatePaymentImport([row],mapping,fixture(),'other')[0].errors.join(),/another branch/);
});
test('payment import detects duplicate rows and existing records without modifying the ledger',()=>{
 const db=fixture();const first=validatePaymentImport([row],mapping,db)[0].payment;
 const result=validatePaymentImport([row,{...row,Status:'Pending'}],mapping,db);
 assert.match(result[1].errors.join(),/Duplicate/);
 db.payments.push({...first,id:'old'});
 assert.match(validatePaymentImport([row],mapping,db)[0].errors.join(),/Duplicate/);
 assert.match(validatePaymentImport([{...row,ID:'old',Reference:'new'}],mapping,db)[0].errors.join(),/Duplicate/);
 assert.equal(db.payments.length,1);
});
test('CSV and Excel files preserve IDs, decimal amounts, and payment dates for validation',()=>{
 for(const bookType of ['csv','xlsx'] as const){
  const book=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet([row]),'Payments');
  const bytes=XLSX.write(book,{type:'buffer',bookType});
  const parsed=XLSX.read(bytes,{type:'buffer',cellDates:true});
  const rows=XLSX.utils.sheet_to_json<Record<string,string>>(parsed.Sheets[parsed.SheetNames[0]],{defval:'',raw:false,dateNF:'yyyy-mm-dd'});
  const preview=validatePaymentImport(rows,mapping,fixture());
  assert.deepEqual(preview[0].errors,[],bookType);
  assert.equal(preview[0].payment.amount,170.5);
  assert.equal(preview[0].payment.date,row.Date);
 }
});
