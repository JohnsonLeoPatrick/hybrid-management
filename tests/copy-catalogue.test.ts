import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('catalogue copy keeps KIP intact and gives BD independent classes and linked prices without duplicates',async()=>{
 const pg=new PGlite();
 try{
  await pg.exec(`create role authenticated;create role anon;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select null::uuid$$;`);
  await pg.exec(await readFile('supabase/schema.sql','utf8'));
  await pg.exec(await readFile('supabase/002_academy_pricing.sql','utf8'));
  await pg.exec(`update branches set name='hybrid@KIP' where id='dd';insert into branches(id,name,code) values('bd','Hybrid BD','BD');`);
  const before=(await pg.query(`select to_jsonb(c) as row from classes c where "branchId"='dd' order by id`)).rows;
  const sql=await readFile('supabase/copy_kip_catalogue_to_bd.sql','utf8');await pg.exec(sql);await pg.exec(sql);
  assert.deepEqual((await pg.query(`select to_jsonb(c) as row from classes c where "branchId"='dd' order by id`)).rows,before);
  assert.equal((await pg.query<{count:number}>(`select count(*)::int as count from classes where "branchId"='bd'`)).rows[0].count,before.length);
  assert.equal((await pg.query(`select p.id from membership_plans p,unnest(p.classes) cid left join classes c on c.id=cid where p."branchId"='bd' and (c.id is null or c."branchId"<>'bd')`)).rows.length,0);
  assert.equal((await pg.query(`select p.id from membership_plans p join membership_plans source on p.id='copy-bd-'||source.id where p.price<>source.price or p.months<>source.months`)).rows.length,0);
  assert.equal((await pg.query(`select * from members`)).rows.length,0);
 }finally{await pg.close();}
});
