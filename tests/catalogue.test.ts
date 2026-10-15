import { test } from 'node:test';
import assert from 'node:assert/strict';
import { academyPlans, academyClasses, upgradeDemoCatalogue } from '../lib/catalogue';
import { seed } from '../lib/seed';
test('advertised monthly prices and schedules match the academy card',()=>{
 assert.equal(academyPlans.length,7);
 assert.equal(academyPlans.find(p=>p.name==='Jeet Kune Do & Kali')?.price,190);
 assert.ok(academyPlans.filter(p=>p.name!=='Jeet Kune Do & Kali').every(p=>p.price===170&&p.months===1));
 assert.equal(academyClasses.find(c=>c.name==='Boxing')?.start,'20:00');
 assert.equal(academyClasses.filter(c=>c.name==='Kickboxing').length,2);
 assert.ok(academyClasses.every(c=>c.end===''));
 for(const p of academyPlans)for(const id of p.classes)assert.ok(academyClasses.some(c=>c.id===id));
});
test('existing demo upgrades retain members, paid amounts and custom plan prices',()=>{
 const db=seed();db.plans=[{id:'p1',name:'Legacy plan',months:1,price:250,description:'Old',branchId:'dd',classes:[],active:true}];db.payments[0].amount=250;
 const upgraded=upgradeDemoCatalogue(db);
 assert.deepEqual(upgraded.members,db.members);assert.deepEqual(upgraded.memberships,db.memberships);assert.deepEqual(upgraded.payments,db.payments);
 assert.equal(upgraded.plans.find(p=>p.id==='p1')?.active,false);
 assert.equal(upgraded.plans.filter(p=>p.active).length,7);
 upgraded.plans.find(p=>p.id==='hybrid-boxing')!.price=180;
 assert.equal(upgradeDemoCatalogue(upgraded).plans.find(p=>p.id==='hybrid-boxing')?.price,180);
});
