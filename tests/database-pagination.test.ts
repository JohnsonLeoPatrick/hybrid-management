import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {loadTableRows} from '../services/pagination';

test('workspace fetches all payments even with a smaller server row cap',async()=>{
 const records=Array.from({length:1205},(_,i)=>({id:String(i).padStart(5,'0'),amount:0.29}));
 let requests=0;
 const client=createClient('https://records.example','public-key',{auth:{persistSession:false},global:{fetch:async input=>{
  const url=new URL(String(input)),offset=Number(url.searchParams.get('offset')||0);
  assert.equal(url.searchParams.get('order'),'id.asc');requests++;
  const data=records.slice(offset,offset+100);
  return new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json','Content-Range':`${offset}-${offset+data.length-1}/${records.length}`}});
 }}});
 assert.deepEqual(await loadTableRows(client,'payments'),records);
 assert.equal(requests,13);
});
test('incomplete fetch fails instead of returning an inaccurate subtotal',async()=>{
 const client=createClient('https://records.example','public-key',{auth:{persistSession:false},global:{fetch:async()=>new Response('[]',{headers:{'Content-Type':'application/json','Content-Range':'*/10'}})}});
 await assert.rejects(loadTableRows(client,'payments'),/Incomplete/);
});
