import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateHybridRegistration, HEALTH_QUESTIONS } from '../lib/registration';
import type { RegistrationDetails } from '../types/onboarding';
import source from '../lib/hybrid-google-form.json';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const details: RegistrationDetails = {name:'New Member',phone:'0123334444',email:'new@example.com',ic:'',dob:'1995-01-01',gender:'Male',address:'Kuala Lumpur',emergencyName:'',emergencyPhone:'0125554444',notes:'',consent:true,company:'',formAnswers:{age:31,relationshipStatus:'Single',health:Object.fromEntries(['heart','chestPain','dizziness','diabetes','asthma','joint','otherHealth'].map(key=>[key,'No'])),healthDetails:'',referral:'Google',referralOther:''}};
test('Hybrid signup requires every health answer and original required personal fields',()=>{
 details.formAnswers!.responses = Object.fromEntries(source.fields.filter(field => field.required && field.options.length).map(field=>[field.id,field.options[0]]));
 assert.equal(HEALTH_QUESTIONS.length,7);
 assert.equal(validateHybridRegistration(details),'');
 for(const key of ['email','dob','address','emergencyPhone'] as const) assert.notEqual(validateHybridRegistration({...details,[key]:''}),'',key);
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
  await pg.exec('create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;');
  const migration = (await readdir('supabase/migrations')).find(name=>name.endsWith('_hybrid_google_form_signup.sql'))!;
  for (const file of ['supabase/schema.sql','supabase/002_academy_pricing.sql','supabase/003_qr_registration.sql','supabase/004_personal_details_registration.sql','supabase/005_multiple_membership_registration.sql',`supabase/migrations/${migration}`]) await pg.exec(await readFile(file,'utf8'));
  const valid = {...details,formAnswers:{...details.formAnswers!,responses:Object.fromEntries(source.fields.filter(field=>field.required && field.options.length).map(field=>[field.id,field.options[0]]))}};
  await pg.exec('set role anon');
  const options = await pg.query<{value:{hybridFormVersion:number}}>("select public.registration_options('dd') as value");
  assert.equal(options.rows[0].value.hybridFormVersion,1);
  const submit = (value:unknown) => pg.query("select public.submit_registration('dd',$1::jsonb)",[JSON.stringify(value)]);
  await assert.rejects(submit({...valid,formAnswers:undefined}),/Complete the Hybrid/);
  await assert.rejects(submit({...valid,formAnswers:{...valid.formAnswers,health:{}}}),/health background/);
  await assert.rejects(submit({...valid,formAnswers:{...valid.formAnswers,responses:{}}}),/emergency contact/);
  await assert.rejects(submit({...valid,formAnswers:{...valid.formAnswers,responses:{...valid.formAnswers.responses,'1873781823':'No'}}}),/acknowledgements/);
  await submit(valid);
  await assert.rejects(pg.query('select "formAnswers" from registration_requests'),/permission denied/);
  await pg.exec('reset role');
  const rows = await pg.query<{formAnswers:unknown}>('select "formAnswers" from registration_requests');
  assert.equal(rows.rows.length,1);
  assert.deepEqual(rows.rows[0].formAnswers,valid.formAnswers);
 } finally { await pg.close(); }
});
