'use client';
import { useId, useState, type ReactNode } from 'react';
import { ArrowRight, Clock3, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export function PaymentGate({unlocked, refresh, children, section='Payments'}: {unlocked:boolean; refresh:()=>Promise<void>; children:ReactNode; section?:'Payments'|'Reports'|'Staff'}) {
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [visible,setVisible]=useState(false);
 const fieldId=useId();
 const staff=section==='Staff';
 if(unlocked)return <>{children}</>;
 return <div className="payment-access-stage"><section className="payment-access-card" aria-labelledby={`${fieldId}-title`}>
  <div className="payment-access-top"><span className="payment-access-symbol"><LockKeyhole size={26} aria-hidden="true"/></span><span className="payment-access-status"><span/>Protected section</span></div>
  <div className="payment-access-heading"><p className="payment-access-eyebrow">{staff?'STAFF ADMINISTRATION':section==='Reports'?'ACADEMY REPORTS':'PAYMENT WORKSPACE'}</p><h2 id={`${fieldId}-title`}>{staff?'Confirm access to Staff':section==='Reports'?'Unlock your reports':'Unlock your payment ledger'}</h2><p>{staff?'Staff roles and permissions control access to your academy. Enter the separate Staff password to continue.':section==='Reports'?'Review revenue, memberships, and academy performance. Use your payment password to continue.':'View transactions, generate invoices, and manage settlements. Enter your payment password to continue.'}</p></div>
  <form onSubmit={async event=>{
  event.preventDefault();setBusy(true);setError('');
  const form=event.currentTarget;
  const password=String(new FormData(form).get('paymentPassword')||'');form.reset();
  try {
   if(!supabase)throw new Error('Database unavailable.');
   const result=staff?await supabase.rpc('unlock_staff',{account_password:password}):await supabase.rpc('unlock_payments',{payment_password:password});
   if(result.error)throw new Error(`${section} security is unavailable. Ask an administrator to apply the security update.`);
   if(result.data!==true)throw new Error(staff?'Access denied. Only super admins can unlock Staff with the separate Staff password. After five failures, wait 15 minutes.':'Access denied. Check your payment password and staff permission. After five failures, wait 15 minutes.');
   await refresh();
  }catch(cause){setError(cause instanceof Error?cause.message:'Could not unlock payments.');}finally{setBusy(false);}
 }}><label className="payment-access-label" htmlFor={fieldId}>{staff?'Staff password':'Payment password'}</label><div className="payment-access-input"><LockKeyhole size={18} aria-hidden="true"/><input id={fieldId} name="paymentPassword" type={visible?'text':'password'} autoComplete="off" placeholder={staff?'Enter your Staff password':'Enter your payment password'} required disabled={busy} aria-invalid={!!error} aria-describedby={`${fieldId}-help${error?` ${fieldId}-error`:''}`}/><button type="button" aria-label={visible?'Hide password':'Show password'} aria-pressed={visible} onClick={()=>setVisible(!visible)}>{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button></div><p className="payment-access-help" id={`${fieldId}-help`}>{staff?'Staff access is separate from Payments and locks after 15 minutes.':'Payments and Reports share the same password and 15-minute access period.'}</p>{error&&<p id={`${fieldId}-error`} role="alert" className="payment-access-error">{error}</p>}<button className="primary payment-access-submit" disabled={busy}><span>{busy?'Verifying access…':section==='Reports'?'Unlock reports':'Unlock payments'}</span><ArrowRight size={18} aria-hidden="true"/></button></form>
  <div className="payment-access-footer"><span><ShieldCheck size={16} aria-hidden="true"/>{staff?'Super admins only':'Approved staff only'}</span><span><Clock3 size={16} aria-hidden="true"/>Locks after 15 minutes</span></div>
 </section><p className="payment-access-caption">{staff?'Knowing the workspace login password does not grant Staff access.':'Need access? Ask your administrator to enable payment permission.'}</p></div>;
}

export function PaymentAccessAdmin({staffId,refresh}: {staffId:string;refresh?:()=>void}) {
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function configure(password:string,allow:boolean){
  setBusy(true);setMessage('');
  try{
   if(!supabase)throw new Error('Database unavailable.');
   const {error}=await supabase.rpc('set_payment_access',{staff_id:staffId,new_password:password,allow_access:allow});
   if(error)throw error;
   setMessage(allow?'Payment password saved. Previous unlocks revoked.':'Payment access revoked.');refresh?.();
  }catch(cause){setMessage(cause instanceof Error?cause.message:'Could not change payment access.');}finally{setBusy(false);}
 }
 return <details><summary>Payment permission</summary><p>Set a separate password only for staff permitted to access payments. Changing it revokes existing payment unlocks.</p><form onSubmit={event=>{event.preventDefault();const form=event.currentTarget;const password=String(new FormData(form).get('newPaymentPassword')||'');form.reset();void configure(password,true);}}><label className="field">New payment password<input name="newPaymentPassword" type="password" autoComplete="new-password" minLength={7} maxLength={72} required/></label><button className="secondary" disabled={busy}>Grant / reset payment access</button><button className="secondary danger" type="button" disabled={busy} onClick={()=>void configure('',false)}>Revoke payment access</button></form><p role="status">{message}</p></details>;
}
