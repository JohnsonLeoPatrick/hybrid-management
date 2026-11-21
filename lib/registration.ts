import type { RegistrationDetails } from '@/types/onboarding';
import hybridForm from './hybrid-google-form.json';

export const REGISTRATION_ORIGIN = 'https://register.hybridcombativegym.com';

export const HEALTH_QUESTIONS = [
 ['heart', 'Have you ever had any heart condition, heart disease, heart attack or a family history of heart-related illnesses?'],
 ['chestPain', 'Do you feel any discomfort or pain when performing physical activities or exercising?'],
 ['dizziness', 'Have you ever experienced dizziness, fainting, shortness of breath or loss of balance during while exercising or being active?'],
 ['diabetes', 'Do you have diabetes or suffer from high blood pressure?'],
 ['asthma', 'Do you suffer from asthma?'],
 ['joint', 'Do you have any bone or joint condition that might worsen with increased physical activity?'],
 ['otherHealth', 'Do you have any health issues, injuries or medications that could stop you from exercising?'],
] as const;
export const REFERRAL_OPTIONS = ['I live nearby', 'Google', 'Family/Friends', 'Social media', 'Other'] as const;

export function validateHybridRegistration(details: RegistrationDetails) {
 const invalid = validateRegistration(details);
 if (invalid) return invalid;
 if (!details.email) return 'Enter your email address.';
 if (!/^\d{4}-\d{2}-\d{2}$/.test(details.dob) || Number.isNaN(Date.parse(details.dob)) || details.dob < '1900-01-01' || details.dob > new Date().toISOString().slice(0, 10)) return 'Enter a valid date of birth.';
 if (!details.address.trim()) return 'Enter your current address.';
 if (!['Male', 'Female'].includes(details.gender)) return 'Select your gender.';
 if (!/^\d{7,20}$/.test(details.emergencyPhone.replace(/\D/g, ''))) return 'Enter a valid emergency contact number.';
 const answers = details.formAnswers;
 if (!answers || !Number.isInteger(answers.age) || answers.age < 1 || answers.age > 125) return 'Enter a valid age.';
 if (HEALTH_QUESTIONS.some(([key]) => !['Yes', 'No'].includes(answers.health[key]))) return 'Answer every health background question.';
 if (!REFERRAL_OPTIONS.includes(answers.referral as typeof REFERRAL_OPTIONS[number])) return 'Tell us how you found out about Hybrid Combative Academy and Gym.';
 if (answers.referral === 'Other' && !answers.referralOther.trim()) return 'Please specify how you found out about Hybrid.';
 for (const field of hybridForm.fields.filter(field => field.required && !['835335530','1816972513','1390327371','1034751384','260300504','1298609699','1170131668'].includes(field.id) && !field.label.includes('?'))) {
  if (!field.options.includes(answers.responses?.[field.id] || '')) return `Please answer: ${field.label}`;
 }
 return '';
}

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
