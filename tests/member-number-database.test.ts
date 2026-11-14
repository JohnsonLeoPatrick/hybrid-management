import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('numbers recycle without merging records, renewal gets a free number, and QR review can buy gym-only plans',async()=>{
 const pg=new PGlite();
 try {
  await pg.exec(`create role authenticated;create role anon;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
  for(const file of ['schema.sql','002_academy_pricing.sql','003_qr_registration.sql','004_personal_details_registration.sql','005_multiple_membership_registration.sql']) await pg.exec(await readFile(`supabase/${file}`,'utf8'));
  await pg.exec(`insert into auth.users values('00000000-0000-0000-0000-000000000001');insert into staff(id,name,email,role,"branchId") values('00000000-0000-0000-0000-000000000001','Admin','admin@example.com','ADMIN','dd');grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
   set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
   insert into members(id,name,"branchId") values('HYB-DD-00001','Expired person','dd'),('HYB-DD-00002','Active person','dd');
   insert into memberships(id,"memberId","planId",start,expiry) values('old','HYB-DD-00001','hybrid-boxing','2020-01-01','2020-02-01'),('active','HYB-DD-00002','hybrid-boxing',current_date,current_date+30);
   insert into payments(id,"memberId","membershipId",amount,date,method,status) values('history','HYB-DD-00001','old',170,'2020-01-01','Cash','Paid');
   update members set "classIds"=array['c2'] where id='HYB-DD-00001';
   insert into attendance(id,"memberId","classId",date) values('visit','HYB-DD-00001','c2','2020-01-01');`);
  await pg.exec('alter default privileges in schema public grant execute on functions to anon,authenticated');
  const migration=(await readdir('supabase/migrations')).find(name=>name.endsWith('_member_numbers_and_gym_plans.sql'))!;
  await pg.exec(await readFile(`supabase/migrations/${migration}`,'utf8'));
  const reusable=async(id:string)=>(await pg.query<{value:boolean}>('select member_number_reusable($1) as value',[id])).rows[0].value;
  assert.equal(await reusable('HYB-DD-00001'),true);
  assert.equal(await reusable('HYB-DD-00002'),false);
  await pg.exec('begin');
  await pg.exec(`insert into memberships(id,"memberId","planId",start,expiry) values('second-plan','HYB-DD-00001','hybrid-muay-thai',current_date,current_date+30)`);
  assert.equal(await reusable('HYB-DD-00001'),false);
  await pg.exec(`insert into members(id,name,"branchId") values('boundary','Six months','dd');
   insert into memberships(id,"memberId","planId",start,expiry) values('boundary-date','boundary','hybrid-boxing','2020-01-01',((now() at time zone 'Asia/Kuala_Lumpur')::date-interval '6 months')::date);`);
  assert.equal(await reusable('boundary'),true);
  await pg.exec(`insert into members(id,name,"branchId") values('recent','Under six months','dd'),('frozen','Frozen person','dd'),('future','Upcoming person','dd');
   insert into memberships(id,"memberId","planId",start,expiry,state) values
   ('recent-date','recent','hybrid-boxing','2020-01-01',((now() at time zone 'Asia/Kuala_Lumpur')::date-interval '6 months'+interval '1 day')::date,'NORMAL'),
   ('frozen-date','frozen','hybrid-boxing','2020-01-01','2020-02-01','FROZEN'),
   ('future-date','future','hybrid-boxing',current_date+1,current_date+30,'NORMAL');`);
  assert.equal(await reusable('recent'),false);
  assert.equal(await reusable('frozen'),false);
  assert.equal(await reusable('future'),false);
  await pg.exec('rollback');
  const number=async(id:string)=>(await pg.query<{number:number|null}>('select "membershipNumber" as number from members where id=$1',[id])).rows[0].number;
  assert.equal(await number('HYB-DD-00001'),1);
  assert.equal(await number('HYB-DD-00002'),2);
  await pg.exec(`set role anon`);
  await assert.rejects(pg.query(`select allocate_membership_number('dd','evil')`),/permission denied/);
  await pg.exec(`reset role;set role authenticated;set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001'`);
  await pg.exec(`insert into members(id,name,"branchId","membershipNumber") values('new-person','New person','dd',999)`);
  assert.equal(await number('new-person'),1);
  assert.equal(await number('HYB-DD-00001'),null);
  assert.equal((await pg.query<{id:string}>('select "memberId" as id from payments where id=\'history\'')).rows[0].id,'HYB-DD-00001');
  assert.equal((await pg.query<{id:string}>('select "memberId" as id from attendance where id=\'visit\'')).rows[0].id,'HYB-DD-00001');
  // apply_changes uses INSERT ON CONFLICT even when editing an existing profile.
  const existing=(await pg.query<Record<string,unknown>>("select * from members where id='HYB-DD-00002'")).rows[0];
  await pg.query('select apply_changes($1::jsonb)',[JSON.stringify([{table:'members',id:'HYB-DD-00002',data:{...existing,name:'Updated person',membershipNumber:1},isNew:false}])]);
  assert.equal(await number('HYB-DD-00002'),2);
  assert.equal(await number('new-person'),1);
  await pg.exec(`insert into memberships(id,"memberId","planId",start,expiry) values('returning','HYB-DD-00001','hybrid-gym-adult',current_date,current_date+30)`);
  assert.equal(await number('HYB-DD-00001'),3);
  assert.equal(await number('new-person'),1);
  await pg.exec('set role anon');
  await pg.query(`select submit_registration('dd',$1::jsonb)`,[JSON.stringify({name:'QR gym member',phone:'0129998888',email:'qr@example.com',consent:true})]);
  await pg.exec(`reset role`);
  const request=(await pg.query<{id:string}>('select id from registration_requests')).rows[0].id;
  await pg.exec(`set role authenticated;set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001'`);
  const choices=[{planId:'hybrid-gym-student',start:'2026-11-14',months:1,amount:70}];
  const approved=(await pg.query<{id:string}>(`select approve_registration_memberships($1,$2::jsonb) as id`,[request,JSON.stringify(choices)])).rows[0].id;
  assert.equal(await number(approved),4);
  assert.equal((await pg.query<{amount:string}>('select amount::text as amount from payments where "memberId"=$1',[approved])).rows[0].amount,'70.00');
  assert.equal((await pg.query('select * from member_classes where "memberId"=$1',[approved])).rows.length,0);
  assert.equal((await pg.query<{price:string}>(`select price::text as price from membership_plans where id='hybrid-gym-adult'`)).rows[0].price,'90.00');
 } finally {await pg.close();}
});
