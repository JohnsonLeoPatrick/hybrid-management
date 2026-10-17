import type { Database, Membership } from '@/types';
import { addMonths, current, today, uid } from './utils';

export interface MembershipSelection { planId: string; start: string; months: number; amount: number }

export function addMembershipSelections(db: Database, memberId: string, selections: MembershipSelection[], method: string, paymentStatus: string, reference = ''): Database {
 if(!selections.length)throw Error('Choose at least one class membership');
 if(new Set(selections.map(s=>s.planId)).size!==selections.length)throw Error('Choose each membership only once');
 let next=db;
 for(const choice of selections){
  if(!Number.isFinite(choice.amount)||choice.amount<0)throw Error('Enter a valid payment amount');
  const result=addPlanMembership(next,memberId,choice.planId,choice.start,choice.months);
  next=result.db;
  if(choice.amount>0)next={...next,payments:[...next.payments,{id:uid(),memberId,membershipId:result.membership.id,amount:choice.amount,date:today(),method,reference,notes:'Class membership',status:paymentStatus}]};
 }
 return next;
}

export function addPlanMembership(db: Database, memberId: string, planId: string, start: string, months: number): { db: Database; membership: Membership } {
 const member=db.members.find(m=>m.id===memberId), plan=db.plans.find(p=>p.id===planId);
 if(!member||!plan||!plan.active||plan.branchId!==member.branchId)throw Error('Select an active plan from the member branch');
 if(!Number.isInteger(months)||months<1)throw Error('Duration must be positive whole months');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!Number.isFinite(Date.parse(start)))throw Error('Enter a valid start date');
 for(const classId of plan.classes){
  const cls=db.classes.find(c=>c.id===classId);
  if(!cls||cls.branchId!==member.branchId)throw Error('Classes must belong to the member branch');
  if(!member.classIds.includes(classId)&&db.members.filter(m=>m.classIds.includes(classId)).length>=cls.capacity)throw Error(cls.name+' is full');
 }
 const previous=current(db,memberId,planId);
 const membership:Membership={id:uid(),memberId,planId,start,expiry:addMonths(start,months),state:'NORMAL',created:new Date().toISOString()};
 return {membership,db:{...db,
  members:db.members.map(m=>m.id===memberId?{...m,classIds:[...new Set([...m.classIds,...plan.classes])]}:m),
  memberships:[...db.memberships,membership],
  renewals:previous?[...db.renewals,{id:uid(),memberId,previousId:previous.id,membershipId:membership.id,date:today()}]:db.renewals
 }};
}
