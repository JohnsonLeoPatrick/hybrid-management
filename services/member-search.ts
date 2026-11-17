import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export async function searchMemberIds(query:string,branch:string,signal?:AbortSignal,client:SupabaseClient|null=supabase):Promise<string[]> {
 if(!client)throw new Error('Supabase is not configured.');
 const ids:string[]=[];
 let total=Infinity;
 while(ids.length<total){
  let request=client.rpc('search_members',{search_text:query.trim(),branch_filter:branch==='all'?null:branch},{count:'exact'}).range(ids.length,ids.length+499);
  if(signal)request=request.abortSignal(signal);
  const {data,error,count}=await request;
  if(error)throw new Error('Member search failed. Please retry.');
  if(count===null||(!data?.length&&ids.length<count))throw new Error('Could not load complete search results. Please retry.');
  total=count;
  ids.push(...(data||[]).map((row:{id:string})=>row.id));
 }
 return ids;
}
