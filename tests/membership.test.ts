import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addMonths, daysLeft, memberNumber, current, currentMemberships, memberStatus, membershipTiming, status, today } from '../lib/utils';
import { addPlanMembership, addMembershipSelections } from '../lib/memberships';
import { seed } from '../lib/seed';

test('future memberships count down to their start and activate on the start date',()=>{
 const membership={...seed().memberships[0],start:'2026-11-15',expiry:'2026-12-15',state:'NORMAL' as const};
 assert.equal(status(membership,'2026-10-16'),'UPCOMING');
 assert.equal(membershipTiming(membership,'2026-10-16'),'Starts in 30 days');
 assert.equal(membershipTiming(membership,'2026-11-14'),'Starts in 1 day');
 assert.equal(status(membership,'2026-11-15'),'EXPIRING SOON');
 assert.equal(membershipTiming(membership,'2026-11-15'),'30 days left');
 assert.equal(membershipTiming(membership,'2026-12-14'),'1 day left');
 assert.equal(membershipTiming(membership,'2026-12-15'),'Expires today');
 assert.equal(status(membership,'2026-12-16'),'EXPIRED');
 assert.equal(membershipTiming(membership,'2026-12-16'),'Expired 1 day ago');
 assert.equal(status({...membership,state:'FROZEN'},'2026-10-16'),'FROZEN');
 assert.equal(status({...membership,state:'CANCELLED'},'2026-10-16'),'CANCELLED');
});
test('calendar renewals clamp month-end and leap days',()=>{assert.equal(addMonths('2026-01-31',1),'2026-02-28');assert.equal(addMonths('2024-01-31',1),'2024-02-29');assert.equal(addMonths('2024-02-29',12),'2025-02-28')});
test('expiry thresholds include today and day thirty',()=>{assert.equal(daysLeft('2026-10-15','2026-10-15'),0);const base=seed().memberships[0];const date=(n:number)=>new Date(Date.parse(today())+n*86400000).toISOString().slice(0,10);assert.equal(status({...base,expiry:date(0)}),'EXPIRING SOON');assert.equal(status({...base,expiry:date(30)}),'EXPIRING SOON');assert.equal(status({...base,expiry:date(31)}),'ACTIVE');assert.equal(status({...base,expiry:date(-1)}),'EXPIRED');assert.equal(status({...base,state:'FROZEN',expiry:date(-1)}),'FROZEN')});
test('member numbers follow the branch and highest existing ID',()=>{const db=seed();assert.equal(memberNumber(db,'dd'),'HYB-DD-00019');db.members.splice(2,1);assert.equal(memberNumber(db,'dd'),'HYB-DD-00019')});
test('a renewal preserves and supersedes historical membership',()=>{const db=seed(),old=current(db,db.members[0].id);db.memberships.push({...old,id:'renewed',created:'2099-01-01T00:00:00Z',start:today(),expiry:addMonths(today(),3)});assert.equal(current(db,db.members[0].id).id,'renewed');assert.ok(db.memberships.some(m=>m.id===old.id));assert.equal(db.memberships.length,19)});

test('boxing and Muay Thai keep independent dates and renew only the selected plan',()=>{
 const db=seed(), member=db.members[0];
 db.memberships=[];db.renewals=[];member.classIds=[];
 const boxing={...db.plans[0],id:'boxing',branchId:member.branchId,classes:[]};
 const thai={...boxing,id:'muay-thai'};db.plans=[boxing,thai];
 const first=addPlanMembership(db,member.id,boxing.id,'2026-10-17',1);
 const second=addPlanMembership(first.db,member.id,thai.id,'2026-10-24',1);
 assert.equal(current(second.db,member.id,boxing.id).expiry,'2026-11-17');
 assert.equal(current(second.db,member.id,thai.id).expiry,'2026-11-24');
 assert.equal(second.db.renewals.length,0);
 const renewed=addPlanMembership(second.db,member.id,boxing.id,'2026-11-18',1);
 assert.equal(renewed.db.renewals[0].previousId,first.membership.id);
 assert.equal(current(renewed.db,member.id,thai.id).id,second.membership.id);
 assert.equal(currentMemberships(renewed.db,member.id).length,2);
 assert.deepEqual(renewed.db.memberships.find(m=>m.id===first.membership.id),first.membership);
});

test('adding a class enrolls its included classes and checks capacity',()=>{
 const db=seed(),member=db.members[0],cls=db.classes.find(c=>c.branchId===member.branchId)!;
 member.classIds=[];cls.capacity=1;
 const plan={...db.plans[0],branchId:member.branchId,classes:[cls.id]};db.plans=[plan];
 for(const m of db.members)m.classIds=[];
 const result=addPlanMembership(db,member.id,plan.id,today(),1);
 assert.ok(result.db.members.find(m=>m.id===member.id)!.classIds.includes(cls.id));
 assert.throws(()=>addPlanMembership(result.db,db.members[1].id,plan.id,today(),1),/full/);
});

test('an expired class does not hide another active class in member totals',()=>{
 const db=seed(),member=db.members[0],ms=db.memberships[0];
 db.memberships=[{...ms,memberId:member.id,planId:'boxing',start:'2020-01-01',expiry:'2020-02-01'},
 {...ms,id:'thai',memberId:member.id,planId:'thai',start:today(),expiry:addMonths(today(),2)}];
 assert.equal(memberStatus(db,member.id),'ACTIVE');
});

test('multiple choices save distinct memberships and payments without changing the input on failure',()=>{
 const db=seed(),member=db.members[0];db.memberships=[];db.payments=[];db.renewals=[];
 const base={...db.plans[0],branchId:member.branchId,classes:[]};db.plans=[{...base,id:'boxing'},{...base,id:'thai'}];
 const selections=[{planId:'boxing',start:'2026-10-17',months:1,amount:170},{planId:'thai',start:'2026-10-24',months:2,amount:340}];
 const next=addMembershipSelections(db,member.id,selections,'Cash','Paid');
 assert.equal(next.memberships.length,2);assert.equal(next.payments.length,2);
 assert.deepEqual(next.memberships.map(m=>m.expiry),['2026-11-17','2026-12-24']);
 assert.deepEqual(next.payments.map(p=>p.amount),[170,340]);
 assert.deepEqual(next.payments.map(p=>p.membershipId),next.memberships.map(m=>m.id));
 assert.throws(()=>addMembershipSelections(db,member.id,[],'Cash','Paid'),/at least one/);
 assert.throws(()=>addMembershipSelections(db,member.id,[selections[0],selections[0]],'Cash','Paid'),/only once/);
 assert.throws(()=>addMembershipSelections(db,member.id,[selections[0],{...selections[1],planId:'invalid'}],'Cash','Paid'),/active plan/);
 assert.equal(db.memberships.length,0);assert.equal(db.payments.length,0);
});
