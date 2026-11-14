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
test('renewal is due on the anniversary, or the first day after a shorter month',()=>{
 assert.equal(membershipExpiry('2026-10-31',1),'2026-12-01');
 assert.equal(membershipExpiry('2026-10-15',1),'2026-11-15');
 assert.equal(membershipExpiry('2026-10-13',1),'2026-11-13');
 assert.equal(membershipExpiry('2026-11-13',1),'2026-12-13');
 assert.equal(membershipExpiry('2026-01-31',1),'2026-03-01');
 assert.equal(membershipExpiry('2026-01-30',1),'2026-03-01');
 assert.equal(membershipExpiry('2026-12-13',1),'2027-01-13');
 assert.equal(membershipExpiry('2024-02-29',12),'2025-03-01');
 assert.equal(membershipExpiry('2024-01-31',1),'2024-03-01');
 const row={...seed().memberships[0],start:'2026-10-31',expiry:'2026-12-01',state:'NORMAL' as const};
 assert.equal(status(row,'2026-11-30'),'EXPIRING SOON');
 assert.equal(status(row,'2026-12-01'),'EXPIRED');
 assert.equal(status({...row,start:'2026-11-13',expiry:membershipExpiry('2026-11-13',1)},'2026-12-13'),'EXPIRED');
});
test('database expiry agrees with previews and preserves membership history protection',async()=>{
 const pg=new PGlite();try{
  await pg.exec('create role anon;create role authenticated;create schema auth;create schema private;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select null::uuid$$;');
  for(const file of ['schema.sql','003_qr_registration.sql','004_personal_details_registration.sql','005_multiple_membership_registration.sql','exclusive_membership_expiry.sql'])await pg.exec(await readFile('supabase/'+file,'utf8'));
  await pg.exec(await readFile('supabase/migrations/20261114075627_calendar_anniversary_expiry.sql','utf8'));
  for (const [start,months] of [['2026-11-13',1],['2026-10-13',1],['2026-01-30',1],['2024-01-31',1],['2024-02-29',12],['2026-12-13',1]] as const) {
   const dates=await pg.query<{expiry:string}>('select membership_expiry($1::date,$2::integer)::text as expiry',[start,months]);
   assert.equal(dates.rows[0].expiry,membershipExpiry(start,months));
  }
  const result=await pg.query<{expiry:string}>("select membership_expiry('2026-10-31',1)::text as expiry");
  assert.equal(result.rows[0].expiry,'2026-12-01');
  const definitions=await pg.query<{definition:string}>("select pg_get_functiondef(oid) as definition from pg_proc where proname in ('approve_registration','approve_registration_memberships')");
  assert.ok(definitions.rows.every(row=>row.definition.includes('public.membership_expiry(')));
  const trigger=await pg.query<{tgenabled:string}>("select tgenabled from pg_trigger where tgname='preserve_memberships'");assert.equal(trigger.rows[0].tgenabled,'O');
 }finally{await pg.close();}
});
