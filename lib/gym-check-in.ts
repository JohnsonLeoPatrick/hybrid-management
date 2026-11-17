export const gymQrTokenPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function gymCheckInLink(origin: string, token: string) {
 const url = new URL(origin);
 if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || !gymQrTokenPattern.test(token)) {
  throw new Error('Invalid check-in link.');
 }
 return new URL(`/check-in/${token}`, url.origin).toString();
}

export const gymCheckInErrors: Record<string, string> = {
 unavailable: 'This check-in QR is unavailable. Please speak to reception.',
 invalid: 'Enter your full name or member ID.',
 not_found: 'No matching member at this branch. Check your full name or member ID, or speak to reception.',
 ambiguous: 'More than one member matches. Enter your member ID or speak to reception.',
 busy: 'Check-in is busy. Wait a minute and try again, or speak to reception.',
};
