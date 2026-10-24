'use client';
import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import type { Database } from '@/types';
import { supabase } from '@/lib/supabase';
import { paymentImportFields, validatePaymentImport, type PaymentImportField, type PaymentImportRow } from '@/lib/payment-import';

export function PaymentImportDialog({db,branch,refresh,notify,close}:{db:Database;branch:string;refresh:()=>Promise<void>;notify:(message:string)=>void;close:()=>void}) {
 const [rows,setRows]=useState<PaymentImportRow[]>([]),[headers,setHeaders]=useState<string[]>([]);
 const [mapping,setMapping]=useState<Partial<Record<PaymentImportField,string>>>({});
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[fileName,setFileName]=useState('');
 const saving=useRef(false),uploadSequence=useRef(0);
 const preview=validatePaymentImport(rows,mapping,db,branch),invalid=preview.filter(row=>row.errors.length).length;
 function template(){
  const book=XLSX.utils.book_new();
  const sheet=XLSX.utils.aoa_to_sheet([['Member ID','Membership ID','Amount','Payment date','Payment method','Payment status','Reference','Notes','Payment ID']]);
  sheet['!cols']=[20,40,14,18,22,18,24,30,40].map(wch=>({wch}));
  XLSX.utils.book_append_sheet(book,sheet,'Payments');
  const lookup=db.memberships.filter(ms=>db.members.some(m=>m.id===ms.memberId&&(branch==='all'||m.branchId===branch))).map(ms=>({'Member ID':ms.memberId,'Member name':db.members.find(m=>m.id===ms.memberId)?.name,'Membership ID':ms.id,'Plan':db.plans.find(p=>p.id===ms.planId)?.name,'Start':ms.start,'Expiry':ms.expiry}));
  XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(lookup),'Member lookup');
  XLSX.writeFile(book,'hybrid-payment-import-template.xlsx');
 }
 return <div className="payment-import"><div className="payment-import-intro"><span><FileSpreadsheet size={23}/></span><div><h3>Bring your payment records together</h3><p>Upload a CSV or Excel file, match the columns, then review before saving.</p></div></div>
 <div className="payment-import-tools"><label className="secondary payment-import-upload"><Upload size={16}/>{busy?'Reading file…':'Choose CSV or Excel'}<input type="file" accept=".csv,.xlsx,.xls" disabled={busy} onChange={async event=>{
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  const request=++uploadSequence.current;setError('');setRows([]);setHeaders([]);setMapping({});setFileName('');setBusy(true);
  try{
   if(!/\.(csv|xlsx|xls)$/i.test(file.name))throw new Error('Choose a CSV or Excel file.');
   if(file.size>10*1024*1024)throw new Error('Maximum file size is 10 MB.');
   const book=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true});
   if(request!==uploadSequence.current)return;
   const sheet=book.Sheets[book.SheetNames[0]];
   if(!sheet)throw new Error('The workbook has no worksheets.');
   const data=XLSX.utils.sheet_to_json<PaymentImportRow>(sheet,{defval:'',raw:false,dateNF:'yyyy-mm-dd'});
   if(!data.length)throw new Error('The first worksheet is empty.');
   if(data.length>5000)throw new Error('Import up to 5,000 payments at a time.');
   const columns=Object.keys(data[0]);
   const aliases:Record<PaymentImportField,string[]>={memberId:['member id','memberid','member number'],membershipId:['membership id','membershipid'],amount:['amount','amount paid','payment amount'],date:['payment date','date'],method:['payment method','method'],status:['payment status','status'],reference:['reference','reference number'],notes:['notes','note'],id:['payment id','id']};
   setHeaders(columns);setMapping(Object.fromEntries(paymentImportFields.map(([key])=>[key,columns.find(c=>aliases[key].includes(c.trim().toLowerCase()))||''])));setRows(data);setFileName(file.name);
  }catch(cause){setError(cause instanceof Error?cause.message:'Could not read the file.');}finally{if(request===uploadSequence.current)setBusy(false);}
 }}/></label><button className="secondary" onClick={template} disabled={busy}><Download size={16}/> Download template</button></div>
 <p className="hint">First worksheet only. Maximum 5,000 rows / 10 MB. Dates: YYYY-MM-DD. Method: Cash, Online Transfer, Credit/Debit Card, E-Wallet, or Other. Status defaults to Paid. The template includes a member and membership lookup sheet.</p>
 {rows.length>0&&<><div className="payment-import-summary"><b>{fileName}</b><span>{rows.length} payments · {invalid} need attention</span></div><h3>Match your columns</h3><div className="form-grid">{paymentImportFields.map(([key,label])=><label className="field" key={key}>{label}<select value={mapping[key]||''} disabled={busy} onChange={event=>setMapping({...mapping,[key]:event.target.value})}><option value="">{key==='status'?'Use Paid':key==='membershipId'?'Auto-match if only one membership':'Not mapped'}</option>{headers.map(header=><option key={header}>{header}</option>)}</select></label>)}</div>
 <h3>Review payments</h3><p className="hint">Nothing saves until every row is valid. Duplicate payments are blocked. Existing records are never overwritten.</p><div className="payment-import-preview"><table><thead><tr><th>ROW / MEMBER</th><th>AMOUNT / DATE</th><th>VALIDATION</th></tr></thead><tbody>{preview.map(({payment,errors},index)=><tr key={index}><td><b>{index+1}. {payment.memberId||'Missing member ID'}</b><small>{db.members.find(m=>m.id===payment.memberId)?.name||'Unknown member'}</small></td><td>{Number.isFinite(payment.amount)?`RM ${payment.amount.toFixed(2)}`:'Invalid amount'}<small>{payment.date||'Missing date'}</small></td><td>{errors.length?<span className="error">{errors.join('; ')}</span>:<span>Ready to import</span>}</td></tr>)}</tbody></table></div></>}
 {error&&<p className="form-feedback" role="alert">{error}</p>}<div className="modal-actions"><button className="secondary" disabled={busy} onClick={close}>Cancel</button><button className="primary" disabled={busy||!rows.length||invalid>0} onClick={async()=>{
  if(saving.current)return;saving.current=true;setBusy(true);setError('');
  try{
   if(!supabase)throw new Error('Database unavailable.');
   const {data,error:failure}=await supabase.rpc('import_payments',{entries:preview.map(row=>row.payment)});
   if(failure)throw new Error(failure.message);
   // Clear the uploaded rows before refreshing so a network failure cannot invite a retry.
   setRows([]);setHeaders([]);setMapping({});notify(`${data} payments imported successfully.`);await refresh();close();
  }catch(cause){setError(cause instanceof Error?cause.message:'Import failed. No payments were saved.');}finally{saving.current=false;setBusy(false);}
 }}>{busy?'Working…':`Import${rows.length?` ${rows.length}`:''} payments`}</button></div></div>;
}
