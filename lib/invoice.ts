import { displayMemberId } from './member-numbers';
import type { Database, Payment } from '@/types';

export const invoiceCompany = {
 name: 'Hybrid Combative Academy & Gym',
 address: ['No. 22-2 & 22, 3, Jalan Damar SD 15/1', 'Bandar Sri Damansara', '52200 Kuala Lumpur, Selangor'],
 phone: '019-699 3060',
 website: 'hybridcombativegym.com',
};

export function invoiceNumber(payment: Pick<Payment, 'id' | 'date'>) {
 const date = new Date(`${payment.date}T00:00:00Z`);
 if (!/^\d{4}-\d{2}-\d{2}$/.test(payment.date) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== payment.date) {
  throw new Error('This payment needs a valid payment date before an invoice can be generated.');
 }
 if (!payment.id.trim()) throw new Error('This payment needs an ID before an invoice can be generated.');
 const weekday = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][date.getUTCDay()];
 return `HYB-INV-${payment.date.replaceAll('-', '')}-${weekday}-${encodeURIComponent(payment.id)}`;
}

export function invoiceDate(value: string) {
 return new Intl.DateTimeFormat('en-MY', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
}

export function invoiceMoney(value: number) {
 return `RM ${value.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function buildInvoice(db: Database, payment: Payment) {
 if (!Number.isFinite(payment.amount) || payment.amount < 0) throw new Error('This payment needs a valid amount before an invoice can be generated.');
 const number = payment.receiptNumber || invoiceNumber(payment);
 const member = db.members.find(item => item.id === payment.memberId);
 const membership = db.memberships.find(item => item.id === payment.membershipId && item.memberId === payment.memberId);
 const plan = db.plans.find(item => item.id === membership?.planId);
 const branch = db.branches.find(item => item.id === (payment.branchId||member?.branchId));
 return {
  number, company: invoiceCompany, date: payment.date, dateLabel: invoiceDate(payment.date),
  paymentId: payment.id, memberId: member ? displayMemberId(member) : payment.memberId||'', memberName: member?.name || payment.customerName || 'Walk-in customer',
  memberAddress: member?.address || '', memberEmail: member?.email || payment.customerEmail || '', memberPhone: member?.phone || '',
  items:payment.items||null, branch: branch?.name || '', description: payment.items?.map(item=>`${item.description} x ${item.quantity}`).join(', ')||plan?.name || 'Membership payment',
  period: membership ? `${invoiceDate(membership.start)} - ${invoiceDate(membership.expiry)}` : '',
  amount: payment.amount, status: payment.status || 'Not specified', method: payment.method || 'Not specified',
  reference: payment.reference || '', notes: [payment.notes,payment.voidReason?`VOID: ${payment.voidReason}; ${payment.voidedAt}`:''].filter(Boolean).join(' · '),
 };
}

export type InvoiceData = ReturnType<typeof buildInvoice>;
