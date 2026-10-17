export interface RegistrationOptions { branch: { id: string; name: string; code: string } }
export interface RegistrationDetails {
 name: string; phone: string; email: string; ic: string; dob: string; gender: string; address: string;
 emergencyName: string; emergencyPhone: string; notes: string; consent: boolean; company: string;
}
export interface RegistrationRequest {
 id: string; branchId: string; planId: string | null; name: string; phone: string; email: string; ic: string; dob: string | null;
 gender: string; address: string; emergencyName: string; emergencyPhone: string; notes: string;
 checkedInAt: string; status: 'PENDING' | 'APPROVED' | 'DECLINED'; memberId: string | null;
}
