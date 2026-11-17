import type { Database } from '@/types';
import { supabase } from '@/lib/supabase';
import { loadTableRows } from './pagination';
const tables: Record<keyof Database,string>={branches:'branches',plans:'membership_plans',classes:'classes',members:'members',memberships:'memberships',payments:'payments',renewals:'membership_renewals',attendance:'attendance',staff:'staff'};
// Shared catalogues support filters, charts, and registration on every section.
export function workspaceTables(section:string,details=false):Set<keyof Database> {
 if(!details&&['Settings','Staff'].includes(section))return new Set(['branches','staff']);
 const keys=new Set<keyof Database>(['branches','plans','classes','members','memberships','staff']);
 if(details||['Dashboard','Payments','Reports'].includes(section))keys.add('payments');
 if(details||['Renewals','Reports'].includes(section))keys.add('renewals');
 if(details||section==='Reports')keys.add('attendance');
 return keys;
}
export async function loadDatabase(section='Dashboard',details=false,only?:Set<keyof Database>): Promise<Database> {
 if(!supabase)throw new Error('Supabase is not configured. Changes cannot be loaded.');
 const client=supabase;
 const keys=only||workspaceTables(section,details);
 const access=keys.has('payments')?await client.rpc('payment_access'):{data:false,error:null};
 if(access.error)throw access.error;
 const entries=await Promise.all(Object.entries(tables).map(async([key,table])=>{
  if(!keys.has(key as keyof Database)||(key==='payments'&&access.data!==true))return [key,[]];
  return [key,await loadTableRows(client,table)];
 }));
 return Object.fromEntries(entries) as unknown as Database;
}
export async function persistDatabase(before: Database, after: Database) { if(!supabase)throw new Error('Supabase is not configured. Changes were not saved.'); const changes=Object.keys(tables).flatMap(key=>{const k=key as keyof Database;return after[k].filter(row=>JSON.stringify(row)!==JSON.stringify(before[k].find(old=>old.id===row.id))).map(row=>({table:tables[k],id:row.id,data:row,isNew:!before[k].some(old=>old.id===row.id),expected:before[k].find(old=>old.id===row.id)}))}); const deletions=Object.keys(tables).flatMap(key=>{const k=key as keyof Database;return before[k].filter(row=>!after[k].some(next=>next.id===row.id)).map(row=>({table:tables[k],id:row.id,expected:row}))});const {error}=await supabase.rpc('apply_changes_checked',{changes,deletions});if(error)throw new Error(error.message); }
