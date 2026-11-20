import {test} from 'node:test';
import assert from 'node:assert/strict';
import {membershipExpiry,status} from '../lib/utils';
import {seed} from '../lib/seed';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';

test('correction audits matching current rows and preserves historical, custom, and missing-date expiries',async()=>{
 const pg=new PGlite();try{
  await pg.exec(`create role anon;create role authenticated;create schema private;
   create table public.memberships(id text primary key,start date,expiry date,deleted boolean default false);
   create function public.protect_history() returns trigger language plpgsql as $$begin raise exception 'History protected';end$$;
   create trigger preserve_memberships before update on public.memberships for each row execute function public.protect_history();
   insert into public.memberships(id,start,expiry) values
    ('current','2099-11-13','2099-12-14'),('history','2000-11-13','2000-12-14'),
    ('missing','2099-10-31','2099-12-01'),('custom','2099-11-13','2099-12-20');`);
  await pg.exec(await readFile('supabase/migrations/20261114075627_calendar_anniversary_expiry.sql','utf8'));
  const rows=await pg.query<{id:string;expiry:string}>('select id,expiry::text from public.memberships order by id');
  assert.deepEqual(rows.rows,[{id:'current',expiry:'2099-12-13'},{id:'custom',expiry:'2099-12-20'},{id:'history',expiry:'2000-12-14'},{id:'missing',expiry:'2099-12-01'}]);
  const audit=await pg.query('select id,previous_expiry::text,corrected_expiry::text from private.calendar_anniversary_expiry_corrections');
  assert.deepEqual(audit.rows,[{id:'current',previous_expiry:'2099-12-14',corrected_expiry:'2099-12-13'}]);
  await assert.rejects(pg.exec("update public.memberships set expiry=expiry+1 where id='current'"),/History protected/);
 }finally{await pg.close();}
});
test('renewal counts the days in the starting calendar months without clamping',()=>{
 assert.equal(membershipExpiry('2026-10-31',1),'2026-12-01');
 assert.equal(membershipExpiry('2026-10-15',1),'2026-11-15');
 assert.equal(membershipExpiry('2026-10-13',1),'2026-11-13');
 assert.equal(membershipExpiry('2026-11-13',1),'2026-12-13');
 assert.equal(membershipExpiry('2026-01-31',1),'2026-03-03');
 assert.equal(membershipExpiry('2026-01-30',1),'2026-03-02');
 assert.equal(membershipExpiry('2026-12-13',1),'2027-01-13');
 assert.equal(membershipExpiry('2024-02-29',12),'2025-03-01');
 assert.equal(membershipExpiry('2024-01-31',1),'2024-03-02');
 const row={...seed().memberships[0],start:'2026-10-31',expiry:'2026-12-01',state:'NORMAL' as const};
 assert.equal(status(row,'2026-11-30'),'EXPIRING SOON');
 assert.equal(status(row,'2026-12-01'),'EXPIRED');
 assert.equal(status({...row,start:'2026-11-13',expiry:membershipExpiry('2026-11-13',1)},'2026-12-13'),'EXPIRED');
});

const expiryCases = [
 ['2027-01-21',1,'2027-02-21'],['2027-01-31',1,'2027-03-03'],
 ['2027-02-28',1,'2027-03-28'],['2027-03-31',1,'2027-05-01'],
 ['2027-04-30',1,'2027-05-30'],['2027-05-31',1,'2027-07-01'],
 ['2027-06-30',1,'2027-07-30'],['2027-07-31',1,'2027-08-31'],
 ['2027-08-31',1,'2027-10-01'],['2027-09-30',1,'2027-10-30'],
 ['2027-10-31',1,'2027-12-01'],['2027-11-30',1,'2027-12-30'],
 ['2027-12-31',1,'2028-01-31'],['2028-01-31',1,'2028-03-02'],
 ['2028-02-21',1,'2028-03-21'],['2028-02-29',1,'2028-03-29'],
 ['2000-01-31',1,'2000-03-02'],['2100-01-31',1,'2100-03-03'],
 ['2027-01-31',2,'2027-03-31'],['2027-01-31',3,'2027-05-01'],
 ['2027-12-31',2,'2028-03-02'],['2028-02-29',12,'2029-03-01'],
] as const;

for(const [start,months,expected] of expiryCases){
 test(`${start} plus ${months} calendar months expires on ${expected}`,()=>{
  assert.equal(membershipExpiry(start,months),expected);
 });
}
test('database expiry agrees with previews and preserves membership history protection',async()=>{
 const pg=new PGlite();try{
  await pg.exec('create role anon;create role authenticated;create schema auth;create schema private;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select null::uuid$$;');
  for(const file of ['schema.sql','003_qr_registration.sql','004_personal_details_registration.sql','005_multiple_membership_registration.sql','exclusive_membership_expiry.sql'])await pg.exec(await readFile('supabase/'+file,'utf8'));
  await pg.exec(await readFile('supabase/migrations/20261114075627_calendar_anniversary_expiry.sql','utf8'));
  await pg.exec(`create or replace function auth.uid() returns uuid language sql as $$select '00000000-0000-0000-0000-000000000001'::uuid$$;
   insert into auth.users(id) values(auth.uid());
   insert into public.staff(id,name,email,role) values(auth.uid()::text,'Expiry staff','expiry@example.com','SUPER ADMIN');
   insert into public.branches(id,name,code) values('expiry-test','Expiry test','ET');
   insert into public.members(id,"branchId",name,phone) values('expiry-member','expiry-test','Expiry member','123');
   insert into public.membership_plans(id,"branchId",name,months,price) values('expiry-plan','expiry-test','Expiry plan',1,100);
   insert into public.memberships(id,"memberId","planId",start,expiry) values('saved-expiry','expiry-member','expiry-plan','2027-01-31','2027-03-01');`);
  await pg.exec(await readFile('supabase/migrations/20261120125503_month_length_membership_expiry.sql','utf8'));
  for (const [start,months,expected] of expiryCases) {
   const dates=await pg.query<{expiry:string}>('select membership_expiry($1::date,$2::integer)::text as expiry',[start,months]);
   assert.equal(dates.rows[0].expiry,expected);
   assert.equal(dates.rows[0].expiry,membershipExpiry(start,months));
  }
  const result=await pg.query<{expiry:string}>("select membership_expiry('2026-10-31',1)::text as expiry");
  assert.equal(result.rows[0].expiry,'2026-12-01');
  const definitions=await pg.query<{definition:string}>("select pg_get_functiondef(oid) as definition from pg_proc where proname in ('approve_registration','approve_registration_memberships')");
  assert.ok(definitions.rows.every(row=>row.definition.includes('public.membership_expiry(')));
  const saved=await pg.query<{expiry:string}>("select expiry::text from public.memberships where id='saved-expiry'");
  assert.equal(saved.rows[0].expiry,'2027-03-01');
  await assert.rejects(pg.exec("update public.memberships set expiry='2027-03-03' where id='saved-expiry'"),/Historical membership/i);
  const trigger=await pg.query<{tgenabled:string}>("select tgenabled from pg_trigger where tgname='preserve_memberships'");assert.equal(trigger.rows[0].tgenabled,'O');
 }finally{await pg.close();}
});
