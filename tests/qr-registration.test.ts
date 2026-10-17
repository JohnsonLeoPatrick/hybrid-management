import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { registrationLink, validateRegistration } from '../lib/registration';
import type { RegistrationDetails } from '../types/onboarding';

const details: RegistrationDetails = { name:'New Member',phone:'+60 12 333 4444',email:'new@example.com',ic:'ID-12345',dob:'1995-01-01',gender:'Other',address:'',emergencyName:'',emergencyPhone:'',notes:'',consent:true,company:'' };
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
  for(const file of ['supabase/schema.sql','supabase/002_academy_pricing.sql','supabase/003_qr_registration.sql','supabase/004_personal_details_registration.sql','supabase/005_multiple_membership_registration.sql'])await pg.exec(await readFile(file,'utf8'));
  await pg.exec(`insert into auth.users values('00000000-0000-0000-0000-000000000001');insert into public.staff(id,name,email,role,"branchId") values('00000000-0000-0000-0000-000000000001','Reception','staff@example.com','STAFF','dd');grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;update membership_plans set active=false;set role anon;`);
  const options=await pg.query<{value:{plans:unknown[]}}>(`select public.registration_options('dd') as value`);
  assert.equal(options.rows[0].value.plans,undefined);
  const submit=(data:RegistrationDetails)=>pg.query(`select public.submit_registration('dd',$1::jsonb)`,[JSON.stringify(data)]);
  await assert.rejects(submit({...details,consent:false}),/Consent/);
  await assert.rejects(submit({...details,phone:'12'}),/phone/);

  // Even an old/tampered client cannot choose a membership through the public RPC.
  await pg.query(`select public.submit_registration('dd',$1::jsonb)`,[JSON.stringify({...details,planId:'hybrid-boxing'})]);await submit(details);
  await assert.rejects(pg.query('select name from public.registration_requests'),/permission denied/);
  await assert.rejects(pg.query(`select public.approve_registration('00000000-0000-0000-0000-000000000000','hybrid-boxing','2026-01-31',170,'Cash','Paid')`),/permission denied/);
  await pg.exec(`reset role`);
  const arrivals=await pg.query<{id:string;checkedInAt:string}>('select id,"checkedInAt" from registration_requests');
  assert.equal(arrivals.rows.length,1);assert.ok(arrivals.rows[0].checkedInAt);
  assert.equal((await pg.query<{planId:null}>('select "planId" from registration_requests')).rows[0].planId,null);
  assert.equal((await pg.query('select * from members')).rows.length,0);
  // Personal-details signup works even before staff configure an active plan.
  await pg.exec(`update membership_plans set active=true`);
  await pg.exec(`set role authenticated;set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001'`);
  const approve=()=>pg.query<{id:string}>(`select public.approve_registration($1,'hybrid-boxing','2026-01-31',170,'Cash','Paid') as id`,[arrivals.rows[0].id]);
  const approved=await approve();assert.equal(approved.rows[0].id,'HYB-DD-00001');
  assert.equal((await approve()).rows[0].id,'HYB-DD-00001');
  assert.equal((await pg.query('select * from members')).rows.length,1);
  assert.equal((await pg.query('select * from payments')).rows.length,1);
  const membership=await pg.query<{expiry:string}>('select expiry::text from memberships');assert.equal(membership.rows[0].expiry,'2026-02-28');
  const request=await pg.query<{status:string;memberId:string}>('select status,"memberId" from registration_requests');assert.equal(request.rows[0].status,'APPROVED');assert.equal(request.rows[0].memberId,'HYB-DD-00001');
  assert.equal((await pg.query('select * from member_classes')).rows.length,1);
  await pg.exec('set role anon');
  await assert.rejects(pg.query(`select public.approve_registration_memberships($1,'[]'::jsonb)`,[arrivals.rows[0].id]),/permission denied/);
  await submit({...details,name:'Multiple Classes',phone:'0125558888',ic:'ID-MULTI',email:'multi@example.com'});
  await pg.exec(`reset role`);
  const pending=(await pg.query<{id:string}>(`select id from registration_requests where status='PENDING'`)).rows[0].id;
  await pg.exec(`set role authenticated;set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001'`);
  const selections=[{planId:'hybrid-boxing',start:'2026-10-17',months:1,amount:170},{planId:'hybrid-muay-thai',start:'2026-10-24',months:2,amount:340}];
  const approveMany=(choices:unknown)=>pg.query<{id:string}>(`select public.approve_registration_memberships($1,$2::jsonb,'Cash','Paid') as id`,[pending,JSON.stringify(choices)]);
  await assert.rejects(approveMany([selections[0],{...selections[1],planId:'invalid'}]),/active plan/);
  assert.equal((await pg.query('select * from members')).rows.length,1);
  assert.equal((await pg.query('select * from memberships')).rows.length,1);
  assert.equal((await pg.query<{status:string}>(`select status from registration_requests where id=$1`,[pending])).rows[0].status,'PENDING');
  await assert.rejects(approveMany([selections[0],selections[0]]),/only once/);
  const multi=await approveMany(selections),memberId=multi.rows[0].id;
  assert.equal((await approveMany(selections)).rows[0].id,memberId);
  assert.equal((await pg.query('select * from memberships where "memberId"=$1',[memberId])).rows.length,2);
  assert.equal((await pg.query('select * from payments where "memberId"=$1',[memberId])).rows.length,2);
  assert.equal((await pg.query('select * from member_classes where "memberId"=$1',[memberId])).rows.length,2);
  const dates=await pg.query<{expiry:string}>(`select expiry::text from memberships where "memberId"=$1 order by expiry`,[memberId]);
  assert.deepEqual(dates.rows.map(m=>m.expiry),['2026-11-17','2026-12-24']);
 }finally{await pg.close()}
});
