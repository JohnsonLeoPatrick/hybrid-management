import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {validateTransactionDate} from '../lib/transaction-dates';
import {today} from '../lib/utils';

test('transaction date checks reject past and impossible dates and accept today and future',()=>{
 assert.throws(()=>validateTransactionDate('2026-11-19','Start date','2026-11-20'),/before today/);
 assert.doesNotThrow(()=>validateTransactionDate('2026-11-20','Start date','2026-11-20'));
 assert.doesNotThrow(()=>validateTransactionDate('2027-01-01','Payment date','2026-11-20'));
 for(const value of ['2026-02-30','','not-a-date'])assert.throws(()=>validateTransactionDate(value,'Start date','2026-01-01'),/valid start date/);
 assert.doesNotThrow(()=>validateTransactionDate(today(),'Start date'));
});

test('QR approvals cannot bypass backdating checks and roll back failed member creation',async()=>{
 const pg=new PGlite();
 try{
  await pg.exec(`create role authenticated;create role anon;create schema auth;create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$select '00000000-0000-4000-8000-000000000001'::uuid$$;
   grant usage on schema auth to authenticated;`);
  for(const file of ['supabase/schema.sql','supabase/003_qr_registration.sql','supabase/004_personal_details_registration.sql','supabase/005_multiple_membership_registration.sql','supabase/migrations/20261120140303_prevent_backdated_transactions.sql']){
   await pg.exec(await readFile(file,'utf8'));
  }
  await pg.exec(`insert into auth.users values('00000000-0000-4000-8000-000000000001');
   insert into public.staff(id,name,email,role) values('00000000-0000-4000-8000-000000000001','Test Staff','test@example.test','STAFF');
   insert into public.branches(id,name,code) values('test','Test academy','TT');
   insert into public.membership_plans(id,name,months,price,"branchId") values('plan','Gym',1,90,'test');
   insert into public.registration_requests(id,"branchId","planId",name,phone,"phoneKey")
    values('11111111-1111-4111-8111-111111111111','test','plan','Test Member','0129999999','0129999999');
   set role authenticated;`);
  const yesterday=new Date(Date.parse(today())-86400000).toISOString().slice(0,10);
  await assert.rejects(pg.query("select public.approve_registration('11111111-1111-4111-8111-111111111111','plan',$1::date,90,'Cash','Paid')",[yesterday]),/before today/);
  const choices=[{planId:'plan',start:yesterday,months:1,amount:90}];
  await assert.rejects(pg.query("select public.approve_registration_memberships('11111111-1111-4111-8111-111111111111',$1::jsonb,'Cash','Paid')",[JSON.stringify(choices)]),/before today/);
  assert.deepEqual((await pg.query('select id from public.members')).rows,[]);
  assert.deepEqual((await pg.query('select status from public.registration_requests')).rows,[{status:'PENDING'}]);
  choices[0].start=today();
  await pg.query("select public.approve_registration_memberships('11111111-1111-4111-8111-111111111111',$1::jsonb,'Cash','Paid')",[JSON.stringify(choices)]);
  assert.equal((await pg.query('select id from public.payments')).rows.length,1);
 }finally{await pg.close();}
});

test('database rejects new backdated transactions and preserves existing history',async()=>{
 const pg=new PGlite();
 try{
  await pg.exec(`create role anon;create role authenticated;
   create table public.memberships(id text primary key,start date,state text default 'NORMAL');
   create table public.payments(id text primary key,date date,status text default 'Pending');
   insert into public.memberships values('history','2020-01-01','NORMAL');
   insert into public.payments values('history','2020-01-01','Pending');`);
  await pg.exec(await readFile('supabase/migrations/20261120140303_prevent_backdated_transactions.sql','utf8'));
  const day="(now() at time zone 'Asia/Kuala_Lumpur')::date";
  await assert.rejects(pg.exec(`insert into public.memberships(id,start) values('past',${day}-1)`),/Start date cannot be before today/);
  await assert.rejects(pg.exec(`insert into public.payments(id,date) values('past',${day}-1)`),/Payment date cannot be before today/);
  await pg.exec(`insert into public.memberships(id,start) values('today',${day}),('future',${day}+1);
   insert into public.payments(id,date) values('today',${day}),('future',${day}+1);`);
  await assert.rejects(pg.exec(`update public.memberships set start=${day}-1 where id='future'`),/before today/);
  await assert.rejects(pg.exec(`update public.payments set date=${day}-1 where id='future'`),/before today/);
  await pg.exec("update public.memberships set state='FROZEN',start=start where id='history';update public.payments set status='Paid',date=date where id='history';");
  assert.deepEqual((await pg.query("select start::text,state from public.memberships where id='history'")).rows,[{start:'2020-01-01',state:'FROZEN'}]);
  assert.deepEqual((await pg.query("select date::text,status from public.payments where id='history'")).rows,[{date:'2020-01-01',status:'Paid'}]);
 }finally{await pg.close();}
});
