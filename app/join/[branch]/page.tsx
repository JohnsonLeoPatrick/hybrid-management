import type { Metadata } from 'next';
import PublicRegistration from '@/components/public-registration';

export const metadata: Metadata = { title: 'Join Hybrid | Member registration', description: 'Register your details and check in with Hybrid Combative Academy & Gym.' };
export default async function JoinPage({ params }: { params: Promise<{ branch: string }> }) {
 const { branch } = await params;
 return <PublicRegistration branchCode={branch}/>;
}
