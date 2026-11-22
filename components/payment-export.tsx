'use client';
import {useState} from 'react';
import {Download,FileSpreadsheet,FileText} from 'lucide-react';
import type {Database,Payment} from '@/types';
import {supabase} from '@/lib/supabase';
import {today} from '@/lib/utils';

export function PaymentExportButtons({db,payments,branch,notify}:{db:Database;payments:Payment[];branch:string;notify:(message:string)=>void}){
 const [busy,setBusy]=useState<'xlsx'|'pdf'|null>(null);
 async function download(format:'xlsx'|'pdf'){
  if(busy)return;setBusy(format);
  try{
   if(!supabase)throw new Error('Database unavailable.');
   const role=await supabase.rpc('staff_role');if(role.error||!['ADMIN','SUPER ADMIN'].includes(role.data))throw new Error('Only managers can export payment ledgers.');
   const access=await supabase.rpc('payment_access');
   if(access.error||access.data!==true)throw new Error('Unlock Payments again before downloading.');
   const {buildPaymentExport,createPaymentWorkbook}=await import('@/lib/payment-export');
   const generated=today(),scope=branch==='all'?'All branches':db.branches.find(b=>b.id===branch)?.name||branch;
   const data=buildPaymentExport(db,payments,scope,generated);
   const filename=`hybrid-payments-${branch.replace(/[^a-z0-9-]/gi,'-')}-${generated}`;
   if(format==='xlsx'){
    const XLSX=await import('xlsx');XLSX.writeFile(createPaymentWorkbook(data),`${filename}.xlsx`);
   }else{
    const [{createPaymentLedgerPdf},{loadInvoiceFonts}]=await Promise.all([import('@/lib/payment-ledger-pdf'),import('@/lib/invoice-pdf')]);
    await createPaymentLedgerPdf(data,await loadInvoiceFonts()).save(`${filename}.pdf`,{returnPromise:true});
   }
   notify(`${format==='xlsx'?'Excel':'PDF'} payment ledger downloaded.`);
  }catch(cause){notify(cause instanceof Error?cause.message:'Could not download payment records.');}finally{setBusy(null);}
 }
 return <><button className="secondary" disabled={!!busy||!payments.length} onClick={()=>void download('xlsx')}><FileSpreadsheet size={16}/>{busy==='xlsx'?'Preparing Excel…':'Download Excel'}</button><button className="secondary" disabled={!!busy||!payments.length} onClick={()=>void download('pdf')}><FileText size={16}/>{busy==='pdf'?'Preparing PDF…':'Download PDF'}<Download size={14}/></button></>;
}
