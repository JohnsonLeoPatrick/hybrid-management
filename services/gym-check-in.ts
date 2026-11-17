import { supabase } from '@/lib/supabase';
import { gymCheckInErrors, gymQrTokenPattern } from '@/lib/gym-check-in';
import type { Database } from '@/types';

function client() {
 if (!supabase) throw new Error('The gym connection is unavailable. Please speak to reception.');
 return supabase;
}

export async function getGymCheckInQr(branchId: string) {
 const {data,error} = await client().rpc('gym_check_in_qr',{branch_id:branchId});
 if (error || typeof data !== 'string' || !gymQrTokenPattern.test(data)) {
  throw new Error('Could not load the check-in QR. Try again or ask your administrator to finish setup.');
 }
 return data;
}

export async function gymCheckInOptions(token: string) {
 if (!gymQrTokenPattern.test(token)) throw new Error(gymCheckInErrors.unavailable);
 const {data,error} = await client().rpc('gym_check_in_options',{qr_token:token});
 if (error || !data || typeof data.branchName !== 'string') throw new Error(gymCheckInErrors.unavailable);
 return data as {branchName:string};
}

export async function submitGymCheckIn(token: string, identifier: string) {
 if (!gymQrTokenPattern.test(token)) throw new Error(gymCheckInErrors.unavailable);
 const {data,error} = await client().rpc('submit_gym_check_in',{qr_token:token,member_identifier:identifier.trim()});
 if (error) throw new Error('Check-in could not be saved. Try again or speak to reception.');
 if (!data || !['checked_in','already_checked_in'].includes(data.status) || typeof data.date !== 'string') {
  throw new Error(gymCheckInErrors[data?.status] || 'Check-in could not be saved. Please speak to reception.');
 }
 return data as {status:'checked_in'|'already_checked_in';date:string};
}

export async function loadTodayAttendance(date: string): Promise<Database['attendance']> {
 const rows:Database['attendance'] = [];
 let total=Infinity;
 while (rows.length<total) {
  const {data,error,count} = await client().from('attendance').select('*',{count:'exact'})
   .eq('deleted',false).eq('date',date).order('id').range(rows.length,rows.length+499);
  if (error || count===null || (!data?.length && rows.length<count)) throw new Error('Could not refresh check-ins.');
  total=count;
  rows.push(...(data||[]));
 }
 return rows;
}
