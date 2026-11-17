import type { Metadata } from 'next';
import PublicGymCheckIn from '@/components/public-gym-check-in';

export const metadata:Metadata = {
 title:'Gym check-in | Hybrid',
 description:'Record your gym visit at Hybrid Combative Academy & Gym.',
 robots:{index:false,follow:false},
 referrer:'no-referrer',
};

export default async function GymCheckInPage({params}:{params:Promise<{token:string}>}) {
 const {token} = await params;
 return <PublicGymCheckIn token={token}/>;
}
