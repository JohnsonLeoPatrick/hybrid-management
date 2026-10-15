import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addMonths, daysLeft, memberNumber, current, status, today } from '../lib/utils';
import { seed } from '../lib/seed';
test('calendar renewals clamp month-end and leap days',()=>{assert.equal(addMonths('2026-01-31',1),'2026-02-28');assert.equal(addMonths('2024-01-31',1),'2024-02-29');assert.equal(addMonths('2024-02-29',12),'2025-02-28')});
test('expiry thresholds include today and day thirty',()=>{assert.equal(daysLeft('2026-10-15','2026-10-15'),0);const base=seed().memberships[0];const date=(n:number)=>new Date(Date.parse(today())+n*86400000).toISOString().slice(0,10);assert.equal(status({...base,expiry:date(0)}),'EXPIRING SOON');assert.equal(status({...base,expiry:date(30)}),'EXPIRING SOON');assert.equal(status({...base,expiry:date(31)}),'ACTIVE');assert.equal(status({...base,expiry:date(-1)}),'EXPIRED');assert.equal(status({...base,state:'FROZEN',expiry:date(-1)}),'FROZEN')});
test('member numbers follow the branch and highest existing ID',()=>{const db=seed();assert.equal(memberNumber(db,'dd'),'HYB-DD-00019');db.members.splice(2,1);assert.equal(memberNumber(db,'dd'),'HYB-DD-00019')});
test('a renewal preserves and supersedes historical membership',()=>{const db=seed(),old=current(db,db.members[0].id);db.memberships.push({...old,id:'renewed',created:'2099-01-01T00:00:00Z',start:today(),expiry:addMonths(today(),3)});assert.equal(current(db,db.members[0].id).id,'renewed');assert.ok(db.memberships.some(m=>m.id===old.id));assert.equal(db.memberships.length,19)});
