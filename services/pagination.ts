import type { SupabaseClient } from '@supabase/supabase-js';

// Follow the server's count even when its row cap is lower than our page size.
export async function loadTableRows(client:SupabaseClient,table:string):Promise<Record<string,unknown>[]> {
 const rows:Record<string,unknown>[]=[];
 let total=Infinity;
 while(rows.length<total) {
  const {data,error,count}=await client.from(table).select('*',{count:'exact'}).eq('deleted',false).order('id').range(rows.length,rows.length+499);
  if (error) throw error;
  if (count===null) throw new Error(`Could not verify complete ${table} records. Retry loading the workspace.`);
  total=count;
  if (!data?.length && rows.length<total) throw new Error(`Incomplete ${table} records. Retry loading the workspace.`);
  rows.push(...(data||[]));
 }
 return rows;
}
