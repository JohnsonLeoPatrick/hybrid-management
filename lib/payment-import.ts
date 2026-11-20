import type { Database, Payment } from '@/types';
import { displayMemberId } from './member-numbers';

export const paymentImportFields = [
 ['memberId','Member ID'],['membershipId','Membership ID'],['amount','Amount'],['date','Payment date'],
 ['method','Payment method'],['status','Payment status'],['reference','Reference'],['notes','Notes'],['id','Payment ID (optional)'],
] as const;
export const paymentMethods=['Cash','QR','Online Transfer','Credit/Debit Card','E-Wallet','Other'];
export const paymentStatuses=['Paid','Pending','Partial','Overdue'];
export type PaymentImportField=typeof paymentImportFields[number][0];
export type PaymentImportRow=Record<string,string>;
export function paymentFingerprint(p:Omit<Payment,'id'|'notes'|'status'>) {
 return JSON.stringify([p.memberId,p.membershipId,p.amount,p.date,p.method,p.reference]);
}
export function validatePaymentImport(rows:PaymentImportRow[],mapping:Partial<Record<PaymentImportField,string>>,db:Database,branch='all') {
 const ids=new Set(db.payments.map(p=>p.id));
 const fingerprints=new Set(db.payments.map(paymentFingerprint));
 return rows.map(row=>{
  const value=(field:PaymentImportField)=>String(row[mapping[field]||'']||'').trim();
  const enteredId=value('memberId');
  const candidates=db.members.filter(m=>displayMemberId(m)===enteredId&&(branch==='all'||m.branchId===branch)&&(!value('membershipId')||db.memberships.some(ms=>ms.id===value('membershipId')&&ms.memberId===m.id)));
  const member=/^\d+$/.test(enteredId) ? (candidates.length===1?candidates[0]:undefined) : db.members.find(m=>m.id===enteredId);
  const memberId=member?.id||enteredId;
  const memberships=db.memberships.filter(m=>m.memberId===memberId);
  const membershipId=value('membershipId')||(memberships.length===1?memberships[0].id:'');
  const rawAmount=value('amount').replace(/^RM\s*/i,'');
  const amount=Number(rawAmount),date=value('date');
  const method=paymentMethods.find(m=>m.toLowerCase()===value('method').toLowerCase())||value('method');
  const status=paymentStatuses.find(s=>s.toLowerCase()===(value('status')||'Paid').toLowerCase())||value('status');
  const payment:Payment={id:value('id'),memberId,membershipId,amount,date,method,status,reference:value('reference'),notes:value('notes')};
  const errors:string[]=[];
  if(!member)errors.push('Member ID not found');
  else if(branch!=='all'&&member.branchId!==branch)errors.push('Member belongs to another branch');
  if(!memberships.some(m=>m.id===membershipId))errors.push(membershipId?'Membership does not belong to this member':'Membership ID required when a member has multiple memberships');
  if(!/^\d+(\.\d{1,2})?$/.test(rawAmount)||!Number.isFinite(amount)||amount<=0||amount>9999999999.99)errors.push('Amount must be positive, with at most 2 decimals');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)errors.push('Use a valid YYYY-MM-DD date');
  if(!paymentMethods.includes(method))errors.push('Choose a supported payment method');
  if(!paymentStatuses.includes(status))errors.push('Choose a supported payment status');
  const fingerprint=paymentFingerprint(payment);
  if((payment.id&&ids.has(payment.id))||fingerprints.has(fingerprint))errors.push('Duplicate payment in file or ledger');
  if(payment.id)ids.add(payment.id);
  fingerprints.add(fingerprint);
  return {payment,errors};
 });
}
