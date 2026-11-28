import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateHybridRegistration, HEALTH_QUESTIONS } from '../lib/registration';
import type { RegistrationDetails } from '../types/onboarding';
import source from '../lib/hybrid-google-form.json';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const details: RegistrationDetails = {name:'New Member',phone:'0123334444',email:'new@example.com',ic:'',dob:'1995-01-01',gender:'Male',address:'Kuala Lumpur',emergencyName:'',emergencyPhone:'0125554444',notes:'',consent:true,company:'',photo:'data:image/jpeg;base64,/9j/2Q==',formAnswers:{age:31,relationshipStatus:'Single',health:Object.fromEntries(['heart','chestPain','dizziness','diabetes','asthma','joint','otherHealth'].map(key=>[key,'No'])),healthDetails:'',referral:'Google',referralOther:''}};
test('Hybrid signup requires every health answer and original required personal fields',()=>{
 details.formAnswers!.responses = Object.fromEntries(source.fields.filter(field => field.required && field.options.length).map(field=>[field.id,field.options[0]]));
 assert.equal(HEALTH_QUESTIONS.length,7);
 assert.equal(validateHybridRegistration(details),'');
 assert.notEqual(validateHybridRegistration({...details,photo:''} as RegistrationDetails),'');
 for(const key of ['email','dob','address','emergencyPhone','photo'] as const) assert.notEqual(validateHybridRegistration({...details,[key]:''}),'',key);
 for(const [key] of HEALTH_QUESTIONS) assert.notEqual(validateHybridRegistration({...details,formAnswers:{...details.formAnswers!,health:{...details.formAnswers!.health,[key]:''}}}),'',key);
 assert.notEqual(validateHybridRegistration({...details,gender:'Other'}),'');
 assert.notEqual(validateHybridRegistration({...details,formAnswers:{...details.formAnswers!,referral:'Other',referralOther:''}}),'');
 for (const field of source.fields.filter(field => field.required && field.options.length === 1)) {
  assert.notEqual(validateHybridRegistration({...details,formAnswers:{...details.formAnswers!,responses:{...details.formAnswers!.responses,[field.id]:''}}}),'',field.label);
 }
});

test('database rejects missing answers and privately retains the complete application',async()=>{
 const pg = new PGlite();
 try {
  await pg.exec(`create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
  const migration = (await readdir('supabase/migrations')).find(name=>name.endsWith('_hybrid_google_form_signup.sql'))!;
  for (const file of ['supabase/schema.sql','supabase/002_academy_pricing.sql','supabase/003_qr_registration.sql','supabase/004_personal_details_registration.sql','supabase/005_multiple_membership_registration.sql',`supabase/migrations/${migration}`,'supabase/migrations/20261128154134_registration_photo.sql']) await pg.exec(await readFile(file,'utf8'));
  const valid = {...details,formAnswers:{...details.formAnswers!,responses:Object.fromEntries(source.fields.filter(field=>field.required && field.options.length).map(field=>[field.id,field.options[0]]))}};
  valid.formAnswers.responses['1407106604.name']='Guardian Example';
  valid.formAnswers.responses['1407106604.phone']='0123456789';
  await pg.exec('set role anon');
  const options = await pg.query<{value:{hybridFormVersion:number}}>("select public.registration_options('dd') as value");
  assert.equal(options.rows[0].value.hybridFormVersion,1);
  const submit = (value:unknown) => pg.query("select public.submit_registration('dd',$1::jsonb)",[JSON.stringify(value)]);
  await assert.rejects(submit({...valid,formAnswers:undefined}),/Complete the Hybrid/);
  await assert.rejects(submit({...valid,formAnswers:{...valid.formAnswers,health:{}}}),/health background/);
  await assert.rejects(submit({...valid,formAnswers:{...valid.formAnswers,responses:{}}}),/emergency contact/);
  await assert.rejects(submit({...valid,formAnswers:{...valid.formAnswers,responses:{...valid.formAnswers.responses,'1873781823':'No'}}}),/acknowledgements/);
  await assert.rejects(submit({...valid,photo:undefined}),/photo/i);
  await assert.rejects(submit({...valid,photo:'https://example.com/photo.jpg'}),/photo/i);
  await assert.rejects(submit({...valid,photo:'data:image/jpeg;base64,/9j/AAAA'}),/photo/i);
  await assert.rejects(submit({...valid,photo:'data:image/jpeg;base64,'+'A'.repeat(140000)}),/photo/i);
  await submit(valid);
  await assert.rejects(pg.query('select "formAnswers" from registration_requests'),/permission denied/);
  await pg.exec('reset role');
  const rows = await pg.query<{formAnswers:unknown;photo:string}>('select "formAnswers",photo from registration_requests');
  assert.equal(rows.rows.length,1);
  assert.equal(rows.rows[0].photo,valid.photo);
  assert.deepEqual(rows.rows[0].formAnswers,valid.formAnswers);
  await pg.exec(`insert into auth.users values('00000000-0000-0000-0000-000000000001');insert into staff(id,name,email,role,"branchId") values('00000000-0000-0000-0000-000000000001','Reception','staff@example.com','STAFF','dd');grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;set role authenticated;set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';`);
  const pending = (await pg.query<{id:string}>('select id from registration_requests')).rows[0].id;
  const approved = await pg.query<{id:string}>(`select approve_registration_memberships($1,$2::jsonb) as id`,[pending,JSON.stringify([{planId:'hybrid-boxing',start:'2026-11-28',months:1,amount:0}])]);
  assert.equal((await pg.query<{photo:string}>('select photo from members where id=$1',[approved.rows[0].id])).rows[0].photo,valid.photo);
  await pg.exec('set role anon');
  await submit({...valid,name:'Second Member',phone:'0129997777',email:'second@example.com'});
  await pg.exec('set role authenticated');
  const second = (await pg.query<{id:string}>("select id from registration_requests where status='PENDING'")).rows[0].id;
  const legacy = await pg.query<{id:string}>(`select approve_registration($1,'hybrid-boxing','2026-11-28',0) as id`,[second]);
  assert.equal((await pg.query<{photo:string}>('select photo from members where id=$1',[legacy.rows[0].id])).rows[0].photo,valid.photo);
 } finally { await pg.close(); }
});
