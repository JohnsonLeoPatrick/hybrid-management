'use client';
import {useState} from 'react';
import {supabase} from '@/lib/supabase';
import {paymentEntryMethods} from '@/lib/payment-methods';
import {toCents} from '@/lib/money';
import {today,uid,money} from '@/lib/utils';
import {WorkspaceDialog} from './workspace-dialog';
import type {PaymentItem,Payment} from '@/types';
import {ShoppingBag,ChevronRight} from 'lucide-react';

export function RetailPayment({branch,refresh,shortcut=false}:{branch:string;refresh:()=>Promise<void>;shortcut?:boolean}){
 const [open,setOpen]=useState(false);
 return <><button className={shortcut?undefined:'primary'} onClick={()=>setOpen(true)}>{shortcut?<><span className="action-icon"><ShoppingBag size={18} strokeWidth={1.5}/></span><span><b>Walk-in / product sale</b></span><ChevronRight size={16}/></>:'Walk-in / product sale'}</button>{open&&<SaleForm branch={branch} refresh={refresh} close={()=>setOpen(false)}/>}</>;
}
function SaleForm({branch,refresh,close}:{branch:string;refresh:()=>Promise<void>;close:()=>void}){
 const [id]=useState(uid),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [items,setItems]=useState<PaymentItem[]>([{description:'Walk-in fee',quantity:1,unitPrice:0}]);
 const update=(index:number,change:Partial<PaymentItem>)=>setItems(current=>current.map((item,i)=>i===index?{...item,...change}:item));
 let cents=0;try{cents=items.reduce((sum,item)=>sum+toCents(item.unitPrice)*item.quantity,0);}catch{/* Entry validation reports invalid prices when saving. */}
 return <WorkspaceDialog title="Walk-in / product sale" label="Record sale" busy={busy} onClose={close}><form onSubmit={async event=>{
  event.preventDefault();setError('');setBusy(true);const form=new FormData(event.currentTarget);
  try{
   const total=items.reduce((sum,item)=>{if(!item.description.trim()||!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>999||toCents(item.unitPrice)<=0)throw Error('Enter an item, whole quantity, and positive price.');return sum+toCents(item.unitPrice)*item.quantity;},0);
   if(!supabase)throw Error('Database unavailable.');
   const {error}=await supabase.from('payments').insert({id,memberId:null,membershipId:null,branchId:branch,items,amount:total/100,date:today(),status:'Paid',method:String(form.get('method')),customerName:String(form.get('customerName')||'').trim(),customerEmail:String(form.get('customerEmail')||'').trim(),reference:String(form.get('reference')||''),notes:String(form.get('notes')||'')});
   if(error)throw error;
   close();await refresh();
  }catch(cause){setError(cause instanceof Error?cause.message:String((cause as {message?:string}).message||cause));}finally{setBusy(false);}
 }}><p>Record payment received. No membership is required.</p>{items.map((item,index)=><fieldset className="signup-question" key={index}><legend>Item {index+1}</legend><label className="field">Item / service<input value={item.description} maxLength={160} required onChange={e=>update(index,{description:e.target.value})}/></label><div className="form-grid"><label className="field">Quantity<input type="number" min={1} max={999} step={1} value={item.quantity} required onChange={e=>update(index,{quantity:Number(e.target.value)})}/></label><label className="field">Unit price (RM)<input type="number" min="0.01" step="0.01" value={item.unitPrice||''} required onChange={e=>update(index,{unitPrice:Number(e.target.value)})}/></label></div>{items.length>1&&<button type="button" className="text-button" onClick={()=>setItems(current=>current.filter((_,i)=>i!==index))}>Remove item</button>}</fieldset>)}<button type="button" className="secondary" disabled={items.length>=20||busy} onClick={()=>setItems(current=>[...current,{description:'',quantity:1,unitPrice:0}])}>Add item</button><h3>Total: {money(cents/100)}</h3><div className="form-grid"><label className="field">Customer name (optional)<input name="customerName" maxLength={120}/></label><label className="field">Customer email (optional)<input name="customerEmail" type="email" maxLength={254}/></label><label className="field">Payment method<select name="method">{paymentEntryMethods.map(method=><option key={method}>{method}</option>)}</select></label><label className="field">Reference (optional)<input name="reference"/></label></div><label className="field">Notes (optional)<input name="notes"/></label>{error&&<p role="alert" className="error">{error}</p>}<div className="modal-actions"><button type="button" className="secondary" disabled={busy} onClick={close}>Cancel</button><button className="primary" disabled={busy}>{busy?'Saving...':'Save payment'}</button></div></form></WorkspaceDialog>;
}
export function VoidPayment({payment,refresh,refund=false}:{payment:Payment;refresh:()=>Promise<void>;refund?:boolean}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 return <><button className="text-button danger" onClick={()=>setOpen(true)}>{refund?'Record full refund':'Void payment'}</button>{open&&<WorkspaceDialog title={refund?'Record full refund':'Void payment'} label="Void payment" busy={busy} onClose={()=>setOpen(false)}><p>{refund?'Confirm only after the full recorded amount has been returned to the customer outside this system. ':''}Keep this payment and its receipt number in the audit history. Exclude it from collections. This does not issue a refund.</p><form onSubmit={async event=>{event.preventDefault();const reason=String(new FormData(event.currentTarget).get('reason')||'').trim();setBusy(true);setError('');try{if(!supabase)throw Error('Database unavailable.');const result=await supabase.rpc(refund?'record_full_refund':'void_payment',{payment_id:payment.id,reason});if(result.error)throw result.error;setOpen(false);await refresh();}catch(cause){setError(String((cause as {message?:string}).message||cause));}finally{setBusy(false);}}}><label className="field">Reason<textarea name="reason" required minLength={3} maxLength={500}/></label>{error&&<p role="alert" className="error">{error}</p>}<div className="modal-actions"><button type="button" className="secondary" disabled={busy} onClick={()=>setOpen(false)}>Cancel</button><button className="primary" disabled={busy}>{refund?'Confirm full refund recorded':'Confirm void'}</button></div></form></WorkspaceDialog>}</>;
}
