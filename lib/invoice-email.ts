import type {InvoiceData} from './invoice';

export function invoiceEmailUrl(invoice: InvoiceData) {
 const email=invoice.memberEmail.trim();
 if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(email)) throw new Error('Save a valid email address on this member’s profile first.');
 const query=new URLSearchParams({view:'cm',fs:'1',to:email,su:`Hybrid invoice ${invoice.number}`,body:`Hello ${invoice.memberName},\n\nPlease find your Hybrid membership invoice ${invoice.number} attached.\n\nThank you,\nHybrid Combative Academy & Gym`});
 return `https://mail.google.com/mail/?${query}`;
}
