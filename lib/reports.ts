import type { Database, Payment } from '../types';
import { sumMoney } from './money';

export interface ReportFilters { branch:string;plan:string;from:string;to:string }
export function reportPayments(db:Database,filters:ReportFilters):Payment[] {
 const members=new Map(db.members.map(member=>[member.id,member]));
 const memberships=new Map(db.memberships.map(membership=>[membership.id,membership]));
 return db.payments.filter(payment=>{
  const member=members.get(payment.memberId),membership=memberships.get(payment.membershipId);
  return !!member && !!membership && membership.memberId===payment.memberId &&
   (filters.branch==='all'||member.branchId===filters.branch) &&
   (filters.plan==='all'||membership.planId===filters.plan) &&
   (!filters.from||payment.date>=filters.from) && (!filters.to||payment.date<=filters.to);
 });
}
export function collectedTotal(payments:Payment[]):number {
 return sumMoney(payments.filter(payment=>['Paid','Partial'].includes(payment.status)).map(payment=>payment.amount));
}
