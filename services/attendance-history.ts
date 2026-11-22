import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export const attendanceHistoryPageSize = 25;
export interface AttendanceHistoryFilters {
 branch:string;
 from:string;
 to:string;
 memberId:string;
 kind:'all'|'gym'|'class';
 page:number;
}
export interface AttendanceHistoryRow {
 id:string;
 memberId:string;
 classId:string|null;
 date:string;
 checkedInAt?:string|null;
 members:{name:string;branchId:string};
 classes:{name:string}|null;
}

export async function loadAttendanceHistory(filters:AttendanceHistoryFilters,signal?:AbortSignal,client:SupabaseClient|null=supabase) {
 if (!client) throw new Error('Supabase is not configured. History cannot be loaded.');
 if (filters.from && filters.to && filters.from > filters.to) throw new Error('Start date must be on or before end date.');
 let query=client.from('attendance')
  .select('id,memberId,classId,date,checkedInAt,members!inner(name,branchId),classes(name)',{count:'exact'})
  .eq('deleted',false)
  .order('date',{ascending:false}).order('checkedInAt',{ascending:false,nullsFirst:false}).order('id',{ascending:false});
 if (filters.branch!=='all') query=query.eq('members.branchId',filters.branch);
 if (filters.memberId!=='all') query=query.eq('memberId',filters.memberId);
 if (filters.from) query=query.gte('date',filters.from);
 if (filters.to) query=query.lte('date',filters.to);
 if (filters.kind==='gym') query=query.is('classId',null);
 if (filters.kind==='class') query=query.not('classId','is',null);
 const offset=Math.max(0,filters.page)*attendanceHistoryPageSize;
 query=query.range(offset,offset+attendanceHistoryPageSize-1);
 if (signal) query=query.abortSignal(signal);
 const {data,error,count}=await query.returns<AttendanceHistoryRow[]>();
 if (error) throw error;
 return {rows:data||[],count:count||0};
}
