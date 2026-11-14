import {test} from 'node:test';
import assert from 'node:assert/strict';
import {membershipExpiry,status} from '../lib/utils';
import {seed} from '../lib/seed';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
test('paid calendar month includes the anniversary; expiry is the following day',()=>{
 assert.equal(membershipExpiry('2026-10-31',1),'2026-12-01');
 assert.equal(membershipExpiry('2026-10-15',1),'2026-11-16');
 assert.equal(membershipExpiry('2024-01-31',1),'2024-03-01');
 const row={...seed().memberships[0],start:'2026-10-31',expiry:'2026-12-01',state:'NORMAL' as const};
 assert.equal(status(row,'2026-11-30'),'EXPIRING SOON');
 assert.equal(status(row,'2026-12-01'),'EXPIRED');
});
test('database expiry agrees with previews and preserves membership history protection',async()=>{
 const pg=new PGlite();try{
  await pg.exec('create role anon;create role authenticated;create schema auth;create schema private;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select null::uuid$$;');
  for(const file of ['schema.sql','003_qr_registration.sql','004_personal_details_registration.sql','005_multiple_membership_registration.sql','exclusive_membership_expiry.sql'])await pg.exec(await readFile('supabase/'+file,'utf8'));
  const result=await pg.query<{expiry:string}>("select membership_expiry('2026-10-31',1)::text as expiry");
  assert.equal(result.rows[0].expiry,'2026-12-01');
  const definitions=await pg.query<{definition:string}>("select pg_get_functiondef(oid) as definition from pg_proc where proname in ('approve_registration','approve_registration_memberships')");
  assert.ok(definitions.rows.every(row=>row.definition.includes('public.membership_expiry(')));
  const trigger=await pg.query<{tgenabled:string}>("select tgenabled from pg_trigger where tgname='preserve_memberships'");assert.equal(trigger.rows[0].tgenabled,'O');
 }finally{await pg.close();}
});
