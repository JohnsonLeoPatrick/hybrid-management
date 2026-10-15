import { Database, Membership } from '@/types';
export const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' });
export const uid = () => crypto.randomUUID();
export function addMonths(date: string, months: number) { const [y,m,d] = date.split('-').map(Number); const last = new Date(Date.UTC(y,m-1+months+1,0)).getUTCDate(); return new Date(Date.UTC(y,m-1+months,Math.min(d,last))).toISOString().slice(0,10); }
export function daysLeft(expiry: string, now = today()) { return Math.round((Date.parse(expiry)-Date.parse(now))/86400000); }
export function status(m?: Membership) { if (!m) return 'EXPIRED'; if(m.state !== 'NORMAL') return m.state; const days = daysLeft(m.expiry); return days < 0 ? 'EXPIRED' : days <= 30 ? 'EXPIRING SOON' : 'ACTIVE'; }
export function current(db: Database, memberId: string) { return db.memberships.filter(m=>m.memberId===memberId).sort((a,b)=>b.created.localeCompare(a.created))[0]; }
export const money = (n: number) => new Intl.NumberFormat('en-MY',{style:'currency',currency:'MYR',maximumFractionDigits:0}).format(n);
export function memberNumber(db: Database, branchId: string) { const code = db.branches.find(b=>b.id===branchId)?.code || 'DD'; const max = Math.max(0,...db.members.filter(m=>m.id.startsWith(`HYB-${code}-`)).map(m=>Number(m.id.split('-').pop())||0)); return `HYB-${code}-${String(max+1).padStart(5,'0')}`; }
