import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
test('schema, atomic registration, RLS, historical records and capacity',async()=>{
 const pg=new PGlite();
 try{
 await pg.exec(`create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
 await pg.exec(await readFile('supabase/schema.sql','utf8'));
 await pg.exec(await readFile('supabase/002_academy_pricing.sql','utf8'));
 assert.equal((await pg.query('select * from membership_plans where active')).rows.length,7);
 await pg.exec(`insert into auth.users values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');insert into staff(id,name,email,role,"branchId") values ('00000000-0000-0000-0000-000000000001','Admin','admin@example.com','SUPER ADMIN','dd'),('00000000-0000-0000-0000-000000000002','Staff','staff@example.com','STAFF','dd');grant usage on schema public,auth to authenticated;grant all on all tables in schema public to authenticated;grant execute on function auth.uid() to authenticated;set role authenticated;set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';`);
 const apply=async(changes:unknown[],deletions:unknown[]=[])=>pg.query('select public.apply_changes($1::jsonb,$2::jsonb)',[JSON.stringify(changes),JSON.stringify(deletions)]);
 const change=(table:string,data:Record<string,unknown>,isNew=true)=>({table,id:data.id,data,isNew});
 await apply([change('classes',{id:'test-boxing',name:'Boxing',coach:'Coach',branchId:'dd',day:'Monday',start:'18:00',end:'19:00',capacity:1}),change('membership_plans',{id:'p1',name:'Monthly',months:1,price:200,description:'Test',branchId:'dd',classes:['test-boxing'],active:true})]);
 await pg.exec(`set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002'`);
 const member={id:'HYB-DD-00001',name:'Test Member',ic:'IC001',dob:'',gender:'Male',phone:'1234',email:'test@example.com',emergencyName:'Contact',emergencyPhone:'5678',address:'KL',registered:'2026-10-15',branchId:'dd',photo:'',medical:'',notes:'',coach:'Coach',classIds:['test-boxing']};
 const membership={id:'m1',memberId:member.id,planId:'p1',start:'2026-10-15',expiry:'2026-11-15',state:'NORMAL',created:'2026-10-15T00:00:00Z'};
 await apply([change('members',member),change('memberships',membership)]);
 assert.equal((await pg.query('select * from member_classes')).rows.length,1);
 await assert.rejects(apply([change('members',{...member,id:'HYB-DD-00002',ic:'IC002',email:'two@example.com'})]),/capacity/i);
 assert.equal((await pg.query('select * from members')).rows.length,1);
 await assert.rejects(apply([change('members',member)]),/already exists/i);
 await assert.rejects(apply([change('membership_plans',{id:'p2',name:'Forbidden',months:1,price:5,description:'',branchId:'dd',classes:[],active:true})]),/row-level security/i);
 await assert.rejects(apply([change('memberships',{...membership,state:'CANCELLED'},false)]),/permission denied/i);
 await apply([change('memberships',{...membership,id:'m2',start:'2026-11-15',expiry:'2026-12-15',created:'2026-10-15T01:00:00Z'}),change('membership_renewals',{id:'r1',memberId:member.id,previousId:'m1',membershipId:'m2',date:'2026-10-15'})]);
 assert.equal((await pg.query('select * from memberships')).rows.length,2);
 await pg.exec(`set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001'`);
 await assert.rejects(pg.exec(`update memberships set expiry='2099-01-01' where id='m1'`),/Historical membership/i);
 await pg.exec(`set request.jwt.claim.sub='00000000-0000-0000-0000-000000000099'`);
 assert.equal((await pg.query('select * from members')).rows.length,0);
 await assert.rejects(apply([change('members',{...member,id:'evil'})]),/Staff access required/i);
 }finally{await pg.close()}
});
