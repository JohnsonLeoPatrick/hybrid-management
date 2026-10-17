import type { MembershipSelection } from '@/lib/memberships';
import { supabase } from '@/lib/supabase';
import type { RegistrationDetails, RegistrationOptions, RegistrationRequest } from '@/types/onboarding';

function client() { if (!supabase) throw new Error('The gym connection is unavailable. Please speak to reception.'); return supabase; }
function errorMessage(error: { code?: string; message: string }) {
 if (['PGRST202', 'PGRST205', '42P01', '42883'].includes(error.code || '')) return 'QR registration is not enabled yet. Reception needs to apply the QR registration database update.';
 return error.message;
}
export async function registrationOptions(branch: string) {
 const { data, error } = await client().rpc('registration_options', { branch_code: branch });
 if (error) throw new Error(errorMessage(error));
 if (!data) throw new Error('This branch is not accepting registrations. Please speak to reception.');
 return data as RegistrationOptions;
}
export async function submitRegistration(branch: string, details: RegistrationDetails) {
 const { data, error } = await client().rpc('submit_registration', { branch_code: branch, details });
 if (error) throw new Error(errorMessage(error));
 if (!data?.received) throw new Error('Your registration was not saved. Please try again or speak to reception.');
}
export async function registrationRequests(branchId?: string) {
 let query = client().from('registration_requests').select('*').order('checkedInAt', { ascending: false }).limit(250);
 if (branchId && branchId !== 'all') query = query.eq('branchId', branchId);
 const { data, error } = await query;
 if (error) throw new Error(errorMessage(error));
 return data as RegistrationRequest[];
}
export async function approveRegistration(id: string, selections: MembershipSelection[], method: string, status: string) {
 const { data, error } = await client().rpc('approve_registration_memberships', { request_id: id, selected_memberships: selections, payment_method: method, payment_status: status });
 if (error) throw new Error(errorMessage(error));
 return data as string;
}
export async function declineRegistration(id: string) {
 const { error } = await client().rpc('decline_registration', { request_id: id });
 if (error) throw new Error(errorMessage(error));
}
