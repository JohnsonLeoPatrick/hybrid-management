import { notFound } from 'next/navigation';
import { sectionRoutes } from '@/lib/section-routes';
export function generateStaticParams(){return Object.values(sectionRoutes).filter(path=>path!=='/').map(path=>({section:path.slice(1)}))}
export default async function SectionPage({params}:{params:Promise<{section:string}>}){
 const {section}=await params;
 if(!Object.values(sectionRoutes).includes('/'+section))notFound();
 return null;
}
