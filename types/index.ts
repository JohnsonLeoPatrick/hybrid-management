export type Role = 'SUPER ADMIN' | 'ADMIN' | 'STAFF';
export interface Branch { id: string; name: string; code: string; address: string; phone: string; active: boolean }
export interface Plan { id: string; name: string; months: number; price: number; description: string; branchId: string; classes: string[]; active: boolean }
export interface GymClass { id: string; name: string; coach: string; branchId: string; day: string; start: string; end: string; capacity: number }
export interface Member { id: string; name: string; ic: string; dob: string; gender: string; phone: string; email: string; emergencyName: string; emergencyPhone: string; address: string; registered: string; branchId: string; photo: string; medical: string; notes: string; coach: string; classIds: string[] }
export interface Membership { id: string; memberId: string; planId: string; start: string; expiry: string; state: 'NORMAL' | 'FROZEN' | 'CANCELLED'; created: string }
export interface Payment { id: string; memberId: string; membershipId: string; amount: number; date: string; method: string; reference: string; notes: string; status: string }
export interface Renewal { id: string; memberId: string; previousId: string; membershipId: string; date: string }
export interface Attendance { id: string; memberId: string; classId: string; date: string }
export interface Staff { id: string; name: string; email: string; role: Role; branchId: string }
export interface Database { branches: Branch[]; plans: Plan[]; classes: GymClass[]; members: Member[]; memberships: Membership[]; payments: Payment[]; renewals: Renewal[]; attendance: Attendance[]; staff: Staff[] }
