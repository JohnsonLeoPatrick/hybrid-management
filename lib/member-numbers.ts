import type { Member } from '@/types';

export function displayMemberId(member: Pick<Member, 'id' | 'membershipNumber'>) {
 if (member.membershipNumber === null) return 'Released';
 const number = member.membershipNumber ?? (/^HYB-[A-Z0-9]+-\d+$/.test(member.id) ? Number(member.id.split('-').pop()) : undefined);
 return number === undefined ? member.id : String(number).padStart(2, '0');
}
