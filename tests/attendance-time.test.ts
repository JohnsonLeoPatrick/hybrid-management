import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {attendanceTime} from '../lib/attendance-time';

test('arrival times use Malaysia time and never invent historical times',()=>{
 assert.match(attendanceTime('2026-11-22T16:30:15Z'),/12:30:15\s*am/i);
 for(const value of [null,undefined,'','invalid'])assert.equal(attendanceTime(value),'Time unavailable');
});
test('server stamps new arrivals, preserves old unknown times, and rejects timestamp edits',async()=>{
 const pg=new PGlite();try{
  await pg.exec(`create role anon;create role authenticated;create table public.attendance(id text primary key);insert into attendance values('old');`);
  await pg.exec(await readFile('supabase/migrations/20261122200740_attendance_timestamps.sql','utf8'));
  assert.equal((await pg.query<{checkedInAt:null}>(`select "checkedInAt" from attendance where id='old'`)).rows[0].checkedInAt,null);
  await pg.exec(`insert into attendance values('new','2000-01-01T00:00:00Z')`);
  assert.equal((await pg.query<{ok:boolean}>(`select "checkedInAt">now()-interval '1 minute' as ok from attendance where id='new'`)).rows[0].ok,true);
  await assert.rejects(pg.exec(`update attendance set "checkedInAt"=now() where id='new'`),/cannot be changed/);
 }finally{await pg.close();}
});
