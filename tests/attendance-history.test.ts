import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { loadAttendanceHistory } from '../services/attendance-history';

test('history queries stored records with branch, dates, member, type, and pagination', async () => {
 let url = new URL('https://history.example');
 const rows = [{id:'past',memberId:'HYB-DD-00001',classId:null,date:'2025-02-03',members:{name:'Member',branchId:'dd'},classes:null}];
 const client = createClient('https://history.example','test-public-key',{auth:{persistSession:false},global:{fetch:async input=>{
  url = new URL(String(input));
  return new Response(JSON.stringify(rows),{headers:{'Content-Type':'application/json','Content-Range':'25-49/80'}});
 }}});
 const result = await loadAttendanceHistory({branch:'dd',from:'2025-01-01',to:'2025-12-31',memberId:'HYB-DD-00001',kind:'gym',page:1},undefined,client);
 assert.deepEqual(result.rows,rows);
 assert.equal(result.count,80);
 assert.equal(url.pathname,'/rest/v1/attendance');
 assert.equal(url.searchParams.get('members.branchId'),'eq.dd');
 assert.equal(url.searchParams.get('memberId'),'eq.HYB-DD-00001');
 assert.deepEqual(url.searchParams.getAll('date'),['gte.2025-01-01','lte.2025-12-31']);
 assert.equal(url.searchParams.get('classId'),'is.null');
 assert.equal(url.searchParams.get('deleted'),'eq.false');
 assert.equal(url.searchParams.get('offset'),'25');
 assert.equal(url.searchParams.get('limit'),'25');
 assert.equal(url.searchParams.get('order'),'date.desc,checkedInAt.desc.nullslast,id.desc');
 assert.match(url.searchParams.get('select') || '',/members!inner/);
});

test('all-time history has no date restriction; class-only filtering excludes gym visits', async () => {
 let url = new URL('https://history.example');
 const client = createClient('https://history.example','test-public-key',{auth:{persistSession:false},global:{fetch:async input=>{
  url = new URL(String(input));
  return new Response('[]',{headers:{'Content-Type':'application/json','Content-Range':'*/0'}});
 }}});
 await loadAttendanceHistory({branch:'all',from:'',to:'',memberId:'all',kind:'class',page:0},undefined,client);
 assert.equal(url.searchParams.has('date'),false);
 assert.equal(url.searchParams.has('members.branchId'),false);
 assert.equal(url.searchParams.has('memberId'),false);
 assert.equal(url.searchParams.get('classId'),'not.is.null');
 await assert.rejects(loadAttendanceHistory({branch:'all',from:'2026-11-05',to:'2026-11-04',memberId:'all',kind:'all',page:0},undefined,client),/Start date/);
 await assert.rejects(loadAttendanceHistory({branch:'all',from:'',to:'',memberId:'all',kind:'all',page:0},undefined,null),/not configured/);
});

test('history failures propagate rather than appearing as an empty history', async () => {
 const client = createClient('https://history.example','test-public-key',{auth:{persistSession:false},global:{fetch:async ()=>
  new Response(JSON.stringify({message:'Permission denied'}),{status:403,headers:{'Content-Type':'application/json'}})
 }});
 await assert.rejects(loadAttendanceHistory({branch:'all',from:'',to:'',memberId:'all',kind:'all',page:0},undefined,client),error=>String((error as Error).message).includes('Permission denied'));
});
