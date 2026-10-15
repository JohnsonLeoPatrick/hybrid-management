import type { Metadata } from 'next';
import './globals.css';
import './dark.css';
import './registration.css';
export const metadata: Metadata = { title:'Hybrid • Academy & Gym',description:'Hybrid Combative Academy & Gym membership management' };
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en"><body>{children}</body></html>}
