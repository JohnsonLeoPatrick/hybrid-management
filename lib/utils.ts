import { Database, Membership } from '@/types';
export const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' });
export const uid = () => crypto.randomUUID();
export function addMonths(date: string, months: number) { const [y,m,d] = date.split('-').map(Number); const last = new Date(Date.UTC(y,m-1+months+1,0)).getUTCDate(); return new Date(Date.UTC(y,m-1+months,Math.min(d,last))).toISOString().slice(0,10); }
export function daysLeft(expiry: string, now = today()) { return Math.round((Date.parse(expiry)-Date.parse(now))/86400000); }
export function status(m?: Membership, now = today()) { if (!m) return 'EXPIRED'; if(m.state !== 'NORMAL') return m.state; if(daysLeft(m.start,now)>0)return 'UPCOMING'; const days = daysLeft(m.expiry,now); return days < 0 ? 'EXPIRED' : days <= 30 ? 'EXPIRING SOON' : 'ACTIVE'; }
export function membershipTiming(m?: Membership, now = today()) {
 if (!m) return 'No membership';
 const startsIn = daysLeft(m.start,now);
 if (startsIn > 0) return `Starts in ${startsIn} ${startsIn===1?'day':'days'}`;
 const remaining = daysLeft(m.expiry,now);
 if (remaining === 0) return 'Expires today';
 const days = Math.abs(remaining), unit = days===1?'day':'days';
 return remaining < 0 ? `Expired ${days} ${unit} ago` : `${days} ${unit} left`;
}
// Each plan has its own membership timeline. Buying another class never replaces it.
export function currentMemberships(db: Database, memberId: string) {
 const latest = new Map<string, Membership>();
 for (const m of db.memberships.filter(m=>m.memberId===memberId).sort((a,b)=>a.created.localeCompare(b.created))) latest.set(m.planId,m);
 return [...latest.values()];
}
export function current(db: Database, memberId: string, planId?: string) {
 const memberships=currentMemberships(db,memberId);
 if(planId)return memberships.find(m=>m.planId===planId)!;
 return memberships.sort((a,b)=>a.expiry.localeCompare(b.expiry))[0];
}
export function memberStatus(db: Database, memberId: string) {
 const states=currentMemberships(db,memberId).map(m=>status(m));
 return ['EXPIRING SOON','ACTIVE','UPCOMING','FROZEN','EXPIRED','CANCELLED'].find(s=>states.includes(s as ReturnType<typeof status>))||'EXPIRED';
}
export const money = (n: number) => new Intl.NumberFormat('en-MY',{style:'currency',currency:'MYR',maximumFractionDigits:0}).format(n);
export function memberNumber(db: Database, branchId: string) { const code = db.branches.find(b=>b.id===branchId)?.code || 'DD'; const max = Math.max(0,...db.members.filter(m=>m.id.startsWith(`HYB-${code}-`)).map(m=>Number(m.id.split('-').pop())||0)); return `HYB-${code}-${String(max+1).padStart(5,'0')}`; }
