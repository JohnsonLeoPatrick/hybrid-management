import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createClient} from '@supabase/supabase-js';
import {workspaceTables} from '../services/database';
import {searchMemberIds} from '../services/member-search';

test('section loading defers unrelated history and loads full dialog dependencies',()=>{
 const member=workspaceTables('Members');
 assert.ok(member.has('memberships'));
 for(const key of ['payments','renewals','attendance'] as const)assert.equal(member.has(key),false);
 assert.equal(workspaceTables('Payments').has('payments'),true);
 assert.equal(workspaceTables('Reports').size,9);
 assert.equal(workspaceTables('Members',true).size,9);
 assert.equal(workspaceTables('Dashboard').has('attendance'),false);
 assert.deepEqual([...workspaceTables('Settings')],['branches','staff']);
});

test('database search follows server row caps and passes query as data',async()=>{
 const seen:unknown[]=[];
 const client=createClient('https://search.example','public-key',{auth:{persistSession:false},global:{fetch:async(input,init)=>{
  const url=new URL(String(input));seen.push(JSON.parse(String(init?.body)));
  const offset=Number(url.searchParams.get('offset')||0);
  return new Response(JSON.stringify([{id:'m'+offset}]),{headers:{'content-type':'application/json','content-range':`${offset}-${offset}/2`}});
 }}});
 assert.deepEqual(await searchMemberIds(' name%,() ','b1',undefined,client),['m0','m1']);
 assert.deepEqual(seen,[{search_text:'name%,()',branch_filter:'b1'},{search_text:'name%,()',branch_filter:'b1'}]);
});

test('checked saves reject stale changes and roll back the whole batch; search respects RLS',async()=>{
 const pg=new PGlite();
 try{
  await pg.exec(`create role authenticated;create role anon;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
  await pg.exec(await readFile('supabase/schema.sql','utf8'));
  await pg.exec(`alter table public.members add column "membershipNumber" integer;`);
  await pg.exec(await readFile('supabase/migrations/20261118090000_workspace_queries_and_conflicts.sql','utf8'));
  await pg.exec(`insert into auth.users values('00000000-0000-0000-0000-000000000001');insert into staff(id,name,email,role) values('00000000-0000-0000-0000-000000000001','Admin','admin@example.test','SUPER ADMIN');insert into branches(id,name,code) values('a','A','AA'),('b','B','BB');set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';insert into members(id,name,"branchId",phone,"membershipNumber") values('m1','Sarah Lim','a','012-345 6789',1),('m2','Sarah Wong','b','555',2);grant usage on schema auth to authenticated;set role authenticated;set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';`);
  assert.deepEqual((await pg.query(`select id from search_members('sarah','a')`)).rows,[{id:'m1'}]);
  assert.deepEqual((await pg.query(`select id from search_members('01',null)`)).rows,[{id:'m1'}]);
  assert.equal((await pg.query(`select * from search_members('%',null)`)).rows.length,0);
  const before=(await pg.query<{row:Record<string,unknown>}>(`select to_jsonb(m) as row from members m where id='m1'`)).rows[0].row;
  const save=(changes:unknown[])=>pg.query('select apply_changes_checked($1::jsonb)',[JSON.stringify(changes)]);
  const change={table:'members',id:'m1',isNew:false,expected:before,data:{...before,name:'Sarah Updated'}};
  await save([change]);
  await assert.rejects(save([change]),/changed since you opened/);
  await assert.rejects(save([{table:'branches',id:'new',isNew:true,data:{id:'new',name:'New',code:'NN'}},change]),/changed since you opened/);
  assert.equal((await pg.query(`select * from branches where id='new'`)).rows.length,0);
  await assert.rejects(save([{...change,expected:undefined}]),/Previous record required/);
  await pg.exec(`set request.jwt.claim.sub='00000000-0000-0000-0000-000000000099'`);
  assert.equal((await pg.query(`select * from search_members('Sarah',null)`)).rows.length,0);
  await assert.rejects(save([change]),/Staff access required/);
 }finally{await pg.close();}
});
