import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seed } from '../lib/seed';
import { money } from '../lib/utils';
import { toCents, sumMoney, durationPrice } from '../lib/money';
import { reportPayments, collectedTotal } from '../lib/reports';
import { addMembershipSelections } from '../lib/memberships';

test('currency retains every cent and sums integer sen',()=>{
 assert.match(money(170.5),/170\.50/);
 assert.equal(toCents(0.29),29);
 assert.equal(sumMoney([0.1,0.2,170.5]),170.8);
 assert.equal(durationPrice(170.55,1,3),511.65);
 assert.equal(durationPrice(100,3,1),33.33);
 assert.throws(()=>toCents(1.005),/2 decimal/);
 assert.throws(()=>toCents(NaN),/amount/);
 assert.throws(()=>toCents(-1),/amount/);
});

test('two plans create separate exact payments; reports include only the chosen plan and received statuses',()=>{
 const db=seed(), member=db.members[0];
 db.payments=[];
 const [a,b]=db.plans.filter(plan=>plan.active).slice(0,2);
 const next=addMembershipSelections(db,member.id,[{planId:a.id,start:'2026-11-04',months:1,amount:170.55},{planId:b.id,start:'2026-11-04',months:1,amount:190.25}],'Cash','Paid');
 assert.equal(next.payments.length,2);
 assert.equal(collectedTotal(reportPayments(next,{branch:'all',plan:'all',from:'',to:''})),360.8);
 assert.equal(collectedTotal(reportPayments(next,{branch:member.branchId,plan:a.id,from:'',to:''})),170.55);
 assert.equal(collectedTotal(reportPayments(next,{branch:'different',plan:'all',from:'',to:''})),0);
 const paid=next.payments[0];
 next.payments.push({...paid,id:'partial',amount:0.2,status:'Partial'},{...paid,id:'pending',amount:500,status:'Pending'},{...paid,id:'overdue',amount:500,status:'Overdue'});
 assert.equal(collectedTotal(reportPayments(next,{branch:'all',plan:a.id,from:paid.date,to:paid.date})),170.75);
 assert.equal(collectedTotal(reportPayments(next,{branch:'all',plan:a.id,from:'2000-01-01',to:'2000-01-02'})),0);
 // A later renewal never moves historical payments to another plan.
 next.memberships.push({...next.memberships[0],id:'future-renewal',planId:b.id,created:'2099-01-01'});
 assert.equal(collectedTotal(reportPayments(next,{branch:'all',plan:a.id,from:'',to:''})),170.75);
 assert.throws(()=>addMembershipSelections(db,member.id,[{planId:a.id,start:'2026-11-04',months:1,amount:1.005}],'Cash','Paid'),/2 decimal/);
});
