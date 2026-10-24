import type { Metadata } from 'next';
import './fonts.css';
import './globals.css';
import './dark.css';
import './registration.css';
import './workspace.css';
import './management.css';
import './invoice.css';
import { WorkspaceExperience } from '@/components/workspace-experience';
export const metadata: Metadata = { title:'Hybrid • Academy & Gym',description:'Hybrid Combative Academy & Gym membership management' };
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en"><head><link rel="preload" href="/fonts/google-sans-400.ttf" as="font" type="font/ttf" crossOrigin="anonymous"/></head><body><WorkspaceExperience>{children}</WorkspaceExperience></body></html>}
