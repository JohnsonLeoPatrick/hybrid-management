import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('database supports gym visits and preserves class enrollment and duplicate protection', async () => {
 const pg = new PGlite();
 try {
  await pg.exec(`create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select '00000000-0000-0000-0000-000000000001'::uuid $$;`);
  await pg.exec(await readFile('supabase/schema.sql','utf8'));
  await pg.exec(await readFile('supabase/migrations/20261104025440_member_check_in.sql','utf8'));
  await pg.exec(`insert into auth.users values('00000000-0000-0000-0000-000000000001');
   insert into staff(id,name,email,role) values('00000000-0000-0000-0000-000000000001','Reception','staff@example.com','STAFF');
   insert into branches(id,name,code) values('test','Test','TT');
   insert into classes(id,name,coach,"branchId",day,start,"end",capacity) values('class','Boxing','Coach','test','Monday','10:00','11:00',20);
   insert into members(id,name,"branchId","classIds") values('member','Member','test',array['class']),('other','Other','test','{}');
   grant usage on schema auth to authenticated;
   set role authenticated;
   select public.apply_changes('[{"table":"attendance","id":"gym","isNew":true,"data":{"id":"gym","memberId":"member","classId":null,"date":"2026-11-04"}}]'::jsonb);
   insert into attendance(id,"memberId","classId",date) values('class','member','class','2026-11-04');`);
  await assert.rejects(pg.exec(`insert into attendance(id,"memberId","classId",date) values('duplicate','member',null,'2026-11-04')`), /unique/);
  await assert.rejects(pg.exec(`insert into attendance(id,"memberId","classId",date) values('duplicate-class','member','class','2026-11-04')`), /unique/);
  await assert.rejects(pg.exec(`insert into attendance(id,"memberId","classId",date) values('not-enrolled','other','class','2026-11-04')`), /enrolled/);
  await pg.exec(`insert into attendance(id,"memberId","classId",date) values('tomorrow','member',null,'2026-11-05')`);
  const result = await pg.query<{count:number}>('select count(*)::int as count from attendance');
  assert.equal(result.rows[0].count,3);
 } finally { await pg.close(); }
});
