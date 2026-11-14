import type { Database, Member } from '../types';
import { today, uid } from './utils';
import { displayMemberId } from './member-numbers';

export function searchMembers(members: Member[], query: string): Member[] {
 const term = query.trim().toLowerCase();
 if (!term) return [];
 const digits = term.replace(/\D/g, '');
 return members.filter(member => [displayMemberId(member), member.id, member.name, member.phone].some(value => value.toLowerCase().includes(term)) ||
  (digits.length >= 3 && /^[+\d\s()-]+$/.test(term) && member.phone.replace(/\D/g, '').includes(digits)))
  .sort((a, b) => Number(displayMemberId(b).toLowerCase() === term) - Number(displayMemberId(a).toLowerCase() === term) || a.name.localeCompare(b.name));
}

export function checkIn(db: Database, memberId: string, classId: string | null, date = today()): Database {
 const member = db.members.find(item => item.id === memberId);
 if (!member) throw new Error('Member not found. Search again.');
 if (classId !== null && (!member.classIds.includes(classId) || !db.classes.some(item => item.id === classId && item.branchId === member.branchId))) {
  throw new Error('Member must be enrolled in this class at their branch.');
 }
 if (db.attendance.some(item => item.memberId === memberId && item.classId === classId && item.date === date)) {
  throw new Error('Already checked in for this visit today.');
 }
 return {...db, attendance:[...db.attendance, {id:uid(), memberId, classId, date}]};
}
