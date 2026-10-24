export const sectionRoutes: Record<string,string> = {
 Dashboard:'/', Members:'/member', 'QR sign-up':'/qr-code', Classes:'/classes',
 Memberships:'/memberships', Renewals:'/renewals', Payments:'/payments',
 Branches:'/branches', Reports:'/reports', Staff:'/staff', Settings:'/settings',
};
export function sectionForPath(path:string){return Object.keys(sectionRoutes).find(section=>sectionRoutes[section]===path)||'Dashboard'}
