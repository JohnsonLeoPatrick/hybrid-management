import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seed } from '../lib/seed';
import { displayMemberId } from '../lib/member-numbers';
import { academyPlans } from '../lib/catalogue';
import { searchMembers } from '../lib/attendance';

test('member numbers pad to two digits and continue beyond 99',()=>{
 const member=seed().members[0];
 assert.equal(displayMemberId({...member,membershipNumber:1}),'01');
 assert.equal(displayMemberId({...member,membershipNumber:100}),'100');
 assert.equal(displayMemberId({...member,membershipNumber:null}),'Released');
 assert.equal(displayMemberId(member),'01');
 const former={...member,membershipNumber:null};
 const newOwner={...member,id:'new-owner',membershipNumber:1};
 assert.equal(searchMembers([former,newOwner],'01')[0].id,'new-owner');
});
test('normal gym adult and student plans have the supplied monthly prices and no class enrollment',()=>{
 for(const [id,price] of [['hybrid-gym-adult',90],['hybrid-gym-student',70]] as const){
  const plan=academyPlans.find(p=>p.id===id);
  assert.ok(plan);assert.equal(plan.price,price);assert.equal(plan.months,1);assert.deepEqual(plan.classes,[]);
 }
});
