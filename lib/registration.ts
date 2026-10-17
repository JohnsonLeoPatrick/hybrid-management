import type { RegistrationDetails } from '@/types/onboarding';

export function validateRegistration(details: RegistrationDetails) {
 if (details.name.trim().length < 2 || details.name.length > 120) return 'Enter your full name (2–120 characters).';
 if (!/^\d{7,20}$/.test(details.phone.replace(/\D/g, ''))) return 'Enter a valid phone number.';
 if (details.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email)) return 'Enter a valid email address.';
 if (!details.consent) return 'Please agree to let the academy use these details for your registration.';
 return '';
}

export function registrationLink(origin: string, branchCode: string) {
 const url = new URL(origin);
 if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Enter a valid website URL.');
 if (!/^[a-z0-9]{2,8}$/i.test(branchCode)) throw new Error('Invalid branch code.');
 return new URL(`/join/${branchCode.toLowerCase()}`, url.origin).toString();
}
