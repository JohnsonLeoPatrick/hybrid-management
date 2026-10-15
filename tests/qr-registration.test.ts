import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { registrationLink, validateRegistration } from '../lib/registration';
import type { RegistrationDetails } from '../types/onboarding';

const details: RegistrationDetails = { name:'New Member',phone:'+60 12 333 4444',email:'new@example.com',ic:'ID-12345',dob:'1995-01-01',gender:'Other',address:'',emergencyName:'',emergencyPhone:'',notes:'',planId:'hybrid-boxing',consent:true,company:'' };
test('QR links stay on the intended gym origin and target the branch form',()=>{
 assert.equal(registrationLink('https://hybrid-management.vercel.app/','DD'),'https://hybrid-management.vercel.app/join/dd');
 assert.equal(registrationLink('https://example.com/old?x=1','AB'),'https://example.com/join/ab');
 assert.throws(()=>registrationLink('javascript:alert(1)','DD'));
 assert.throws(()=>registrationLink('https://user:password@example.com','DD'));
 assert.equal(validateRegistration({...details,consent:false}).includes('agree'),true);
 assert.equal(validateRegistration(details),'');
});
test('public registration is private, idempotent, checked in and approved transactionally',async()=>{
 const pg=new PGlite();
 try{
  await pg.exec(`create role authenticated;create role anon;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
  for(const file of ['supabase/schema.sql','supabase/002_academy_pricing.sql','supabase/003_qr_registration.sql'])await pg.exec(await readFile(file,'utf8'));
  await pg.exec(`insert into auth.users values('00000000-0000-0000-0000-000000000001');insert into public.staff(id,name,email,role,"branchId") values('00000000-0000-0000-0000-000000000001','Reception','staff@example.com','STAFF','dd');grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;set role anon;`);
  const options=await pg.query<{value:{plans:unknown[]}}>(`select public.registration_options('dd') as value`);
  assert.equal(options.rows[0].value.plans.length,7);
  const submit=(data:RegistrationDetails)=>pg.query(`select public.submit_registration('dd',$1::jsonb)`,[JSON.stringify(data)]);
  await assert.rejects(submit({...details,consent:false}),/Consent/);
  await assert.rejects(submit({...details,phone:'12'}),/phone/);
  await assert.rejects(submit({...details,planId:'made-up'}),/available membership/);
  await submit(details);await submit(details);
  await assert.rejects(pg.query('select name from public.registration_requests'),/permission denied/);
  await assert.rejects(pg.query(`select public.approve_registration('00000000-0000-0000-0000-000000000000','hybrid-boxing','2026-01-31',170,'Cash','Paid')`),/permission denied/);
  await pg.exec(`reset role`);
  const arrivals=await pg.query<{id:string;checkedInAt:string}>('select id,"checkedInAt" from registration_requests');
  assert.equal(arrivals.rows.length,1);assert.ok(arrivals.rows[0].checkedInAt);
  assert.equal((await pg.query('select * from members')).rows.length,0);
  await pg.exec(`set role authenticated;set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001'`);
  const approve=()=>pg.query<{id:string}>(`select public.approve_registration($1,'hybrid-boxing','2026-01-31',170,'Cash','Paid') as id`,[arrivals.rows[0].id]);
  const approved=await approve();assert.equal(approved.rows[0].id,'HYB-DD-00001');
  assert.equal((await approve()).rows[0].id,'HYB-DD-00001');
  assert.equal((await pg.query('select * from members')).rows.length,1);
  assert.equal((await pg.query('select * from payments')).rows.length,1);
  const membership=await pg.query<{expiry:string}>('select expiry::text from memberships');assert.equal(membership.rows[0].expiry,'2026-02-28');
  const request=await pg.query<{status:string;memberId:string}>('select status,"memberId" from registration_requests');assert.equal(request.rows[0].status,'APPROVED');assert.equal(request.rows[0].memberId,'HYB-DD-00001');
  assert.equal((await pg.query('select * from member_classes')).rows.length,1);
 }finally{await pg.close()}
});
