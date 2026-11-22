import { displayMemberId } from './member-numbers';
import * as XLSX from 'xlsx';
import type {Database,Payment} from '@/types';
import { sumMoney } from './money';

export function buildPaymentExport(db:Database,payments:Payment[],branch:string,generated:string){
 const rows=payments.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(p=>{
  const member=db.members.find(m=>m.id===p.memberId);
  const membership=db.memberships.find(m=>m.id===p.membershipId);
  if(!Number.isFinite(p.amount)||p.amount<0)throw new Error('A payment has an invalid amount. Check the ledger before exporting.');
  return {'Member':member?.name||p.customerName||'Walk-in customer','Member ID':member ? displayMemberId(member) : p.memberId,'Membership':p.items?.map(item=>`${item.description} x ${item.quantity}`).join(', ')||db.plans.find(plan=>plan.id===membership?.planId)?.name||'Archived plan','Amount (RM)':p.amount,'Payment date':p.date,'Method':p.method,'Reference':p.reference,'Status':p.status,'Notes':[p.notes,p.receiptNumber,p.voidReason?`VOID: ${p.voidReason}; ${p.voidedAt}; ${p.voidedBy}`:''].filter(Boolean).join(' · '),'Payment ID':p.id,'Membership ID':p.membershipId};
 });
 return {branch,generated,rows,total:sumMoney(rows.filter(row=>row.Status!=='Void').map(row=>row['Amount (RM)']))};
}
export type PaymentExport=ReturnType<typeof buildPaymentExport>;
export function createPaymentWorkbook(data:PaymentExport){
 const book=XLSX.utils.book_new();
 const sheet=XLSX.utils.aoa_to_sheet([
  ['HYBRID COMBATIVE ACADEMY & GYM'],['Payment ledger'],['Branch',data.branch],
  ['Generated',data.generated],['Payment records',data.rows.length,'Total recorded (RM)',data.total],[],
 ]);
 XLSX.utils.sheet_add_json(sheet,data.rows,{origin:'A7'});
 sheet['!cols']=[28,21,30,18,18,23,30,16,45,40,40].map(wch=>({wch}));
 sheet['!merges']=[XLSX.utils.decode_range('A1:K1'),XLSX.utils.decode_range('A2:K2')];
 sheet['!autofilter']={ref:`A7:K${Math.max(7,data.rows.length+7)}`};
 sheet.D5.z='"RM" #,##0.00';
 for(let i=0;i<data.rows.length;i++)sheet[`D${i+8}`].z='"RM" #,##0.00';
 XLSX.utils.book_append_sheet(book,sheet,'Payments');
 return book;
}
