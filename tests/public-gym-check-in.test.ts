import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {gymCheckInLink} from '../lib/gym-check-in';

test('check-in links use the current site origin and reject invalid tokens and unsafe URLs',()=>{
 const token='11111111-1111-4111-8111-111111111111';
 assert.equal(gymCheckInLink('https://gym.example/settings?x=1',token),`https://gym.example/check-in/${token}`);
 assert.throws(()=>gymCheckInLink('javascript:alert(1)',token));
 assert.throws(()=>gymCheckInLink('https://name:password@gym.example',token));
 assert.throws(()=>gymCheckInLink('https://gym.example','../member'));
});

test('public gym check-in works with the real attendance schema, triggers, and staff permissions',async()=>{
 const pg=new PGlite();
 try{
  await pg.exec(`create role authenticated;create role anon;create schema private;create schema auth;
   create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$select '00000000-0000-4000-8000-000000000001'::uuid$$;
   grant usage on schema public,auth to anon,authenticated;`);
  await pg.exec(await readFile('supabase/schema.sql','utf8'));
  await pg.exec(await readFile('supabase/migrations/20261104025440_member_check_in.sql','utf8'));
  await pg.exec(`alter table public.members add column "membershipNumber" integer;
   insert into auth.users values('00000000-0000-4000-8000-000000000001');
   insert into public.staff(id,name,email,role) values('00000000-0000-4000-8000-000000000001','Test admin','preview@example.test','SUPER ADMIN');
   insert into public.branches(id,name,code) values('test','Test academy','TT');
   insert into public.members(id,name,"branchId","membershipNumber") values('test-member','Test Member','test',1);`);
  await pg.exec(await readFile('supabase/migrations/20261117080257_public_gym_check_in.sql','utf8'));
  await pg.exec('set role authenticated;');
  const result=await pg.query<{token:string}>("select public.gym_check_in_qr('test') as token");
  await pg.exec('reset role;grant select on public.members to anon;grant insert on public.attendance to anon;set role anon;');
  assert.deepEqual((await pg.query('select * from public.members')).rows,[]);
  await assert.rejects(pg.query("insert into public.attendance(id,\"memberId\",\"classId\",date) values('forged','test-member',null,current_date)"),/row-level security/);
  const submit=await pg.query<{result:{status:string}}>('select public.submit_gym_check_in($1::uuid,$2) as result',[result.rows[0].token,'01']);
  assert.equal(submit.rows[0].result.status,'checked_in');
  assert.deepEqual((await pg.query('select * from public.members')).rows,[]);
  await pg.exec('reset role;set role authenticated');
  const attendance=await pg.query('select "memberId","classId" from public.attendance');
  assert.deepEqual(attendance.rows,[{memberId:'test-member',classId:null}]);
 }finally{await pg.close();}
});

test('public QR records branch-scoped gym visits without exposing member records',async()=>{
 const pg=new PGlite();
 try{
  await pg.exec(`create role anon;create role authenticated;create schema private;create schema auth;
   grant usage on schema public,auth to anon,authenticated;
   create function auth.uid() returns uuid language sql as $$select '11111111-1111-4111-8111-111111111111'::uuid$$;
   create function public.staff_role() returns text language sql as $$select nullif(current_setting('test.staff_role',true),'')$$;
   create table public.branches(id text primary key,name text,active boolean default true,deleted boolean default false);
   create table public.members(id text primary key,name text,"branchId" text,"membershipNumber" integer,deleted boolean default false);
   create table public.attendance(id text primary key,"memberId" text,"classId" text,date date,deleted boolean default false);
   create unique index attendance_gym_member_date_unique on public.attendance("memberId",date) where "classId" is null;
   insert into public.branches(id,name) values('a','Academy A'),('b','Academy B');
   insert into public.members(id,name,"branchId","membershipNumber") values
   ('m1','Jane Doe','a',1),('m2','Jane Doe','b',1),('m3','Sam Lee','a',2),('m4','Sam Lee','a',3),
   ('m5','Former Owner','a',null),('m6','Archived','a',4);
   update public.members set deleted=true where id='m6';
   select set_config('test.staff_role','SUPER ADMIN',false);`);
  await pg.exec(await readFile('supabase/migrations/20261117080257_public_gym_check_in.sql','utf8'));
  const admin=await pg.query<{token:string}>("select public.gym_check_in_qr('a') as token");
  const token=admin.rows[0].token;
  assert.match(token,/^[0-9a-f-]{36}$/);
  assert.equal((await pg.query<{token:string}>("select public.gym_check_in_qr('a') as token")).rows[0].token,token);
  await pg.exec("select set_config('test.staff_role','STAFF',false);set role authenticated;");
  await assert.rejects(pg.query("select public.gym_check_in_qr('a')"),/administrator/i);
  await pg.exec('reset role;set role anon;');
  await assert.rejects(pg.query("select public.gym_check_in_qr('a')"),/permission denied/);
  const rpc=async(identifier:string,t=token)=>(await pg.query<{result:{status:string;date?:string}}>('select public.submit_gym_check_in($1::uuid,$2) as result',[t,identifier])).rows[0].result;
  const options=await pg.query<{result:unknown}>('select public.gym_check_in_options($1::uuid) as result',[token]);
  assert.deepEqual(options.rows[0].result,{branchName:'Academy A'});
  assert.equal((await rpc('Jane')).status,'not_found');
  assert.equal((await rpc('Sam Lee')).status,'ambiguous');
  assert.equal((await rpc('Archived')).status,'not_found');
  assert.equal((await rpc('00000000000000000000000000009999')).status,'not_found');
  assert.equal((await rpc('m2')).status,'not_found');
  assert.equal((await rpc('Jane Doe','22222222-2222-4222-8222-222222222222')).status,'unavailable');
  assert.equal((await rpc('  JANE   DOE  ')).status,'checked_in');
  assert.equal((await rpc('01')).status,'already_checked_in');
  assert.equal((await rpc('m3')).status,'checked_in');
  await assert.rejects(pg.query('select * from public.members'),/permission denied/);
  await assert.rejects(pg.query('select * from public.attendance'),/permission denied/);
  await assert.rejects(pg.query('select * from private.gym_check_in_codes'),/permission denied/);
  await assert.rejects(pg.query("insert into public.attendance values('forged','m2',null,current_date,false)"),/permission denied/);
  await pg.exec('reset role');
  const visits=await pg.query<{memberId:string;classId:null;correctDate:boolean}>(`select "memberId","classId",date=(now() at time zone 'Asia/Kuala_Lumpur')::date as "correctDate" from public.attendance order by "memberId"`);
  assert.deepEqual(visits.rows,[{memberId:'m1',classId:null,correctDate:true},{memberId:'m3',classId:null,correctDate:true}]);
  await pg.exec("update public.branches set active=false where id='a';set role anon");
  assert.equal((await rpc('01')).status,'unavailable');
  await pg.exec("reset role;update public.branches set active=true where id='a';update private.gym_check_in_codes set attempts=60,window_start=date_trunc('minute',now());set role anon;");
  assert.equal((await rpc('01')).status,'busy');
 }finally{await pg.close();}
});
