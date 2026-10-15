import { Database, GymClass, Plan } from '@/types';

// Prices and start times transcribed from the academy's supplied price card.
// End times and unlisted coaches are intentionally left unconfirmed.
export const academyClasses: GymClass[] = [
 {id:'c2',name:'Boxing',coach:'Coach Farouqi (IBA Referee & RMAF Coach)',branchId:'dd',day:'Monday',start:'20:00',end:'',capacity:24},
 {id:'kickboxing-tue',name:'Kickboxing',coach:'To be assigned',branchId:'dd',day:'Tuesday',start:'20:30',end:'',capacity:24},
 {id:'kickboxing-sat',name:'Kickboxing',coach:'To be assigned',branchId:'dd',day:'Saturday',start:'10:15',end:'',capacity:24},
 {id:'jkd-tue',name:'Jeet Kune Do & Kali',coach:'Master Eric Khoo (7th Dan ITF / JKD Expert)',branchId:'dd',day:'Tuesday',start:'18:00',end:'',capacity:24},
 {id:'c3',name:'Mixed Martial Arts (MMA)',coach:'Coach Ray (SEA Games Wrestling Gold Medallist)',branchId:'dd',day:'Wednesday',start:'19:00',end:'',capacity:24},
 {id:'c1',name:'Muay Thai',coach:'To be assigned',branchId:'dd',day:'Friday',start:'19:30',end:'',capacity:24},
 {id:'tkd-thu',name:'Tae Kwon Do (ITF) · Kids',coach:'To be assigned',branchId:'dd',day:'Thursday',start:'17:00',end:'',capacity:24},
 {id:'tkd-sat',name:'Tae Kwon Do (ITF)',coach:'To be assigned',branchId:'dd',day:'Saturday',start:'10:15',end:'',capacity:24},
 {id:'bjj-sun',name:'Brazilian Jiu-Jitsu',coach:'Professor Azrai (15+ Years BJJ Mastery)',branchId:'dd',day:'Sunday',start:'09:30',end:'',capacity:24},
];
export const academyPlans: Plan[] = [
 {id:'hybrid-boxing',name:'Boxing',months:1,price:170,description:'Monday 8:00 PM · Coach Farouqi',branchId:'dd',classes:['c2'],active:true},
 {id:'hybrid-kickboxing',name:'Kickboxing',months:1,price:170,description:'Tuesday 8:30 PM & Saturday 10:15 AM · Striking technique, agility & conditioning',branchId:'dd',classes:['kickboxing-tue','kickboxing-sat'],active:true},
 {id:'hybrid-jkd',name:'Jeet Kune Do & Kali',months:1,price:190,description:'Tuesday 6:00 PM · Master Eric Khoo',branchId:'dd',classes:['jkd-tue'],active:true},
 {id:'hybrid-mma',name:'Mixed Martial Arts (MMA)',months:1,price:170,description:'Wednesday 7:00 PM · Coach Ray',branchId:'dd',classes:['c3'],active:true},
 {id:'hybrid-muay-thai',name:'Muay Thai',months:1,price:170,description:'Friday 7:30 PM · Clinch work, power kicks, pad work & stamina',branchId:'dd',classes:['c1'],active:true},
 {id:'hybrid-tkd',name:'Tae Kwon Do (ITF)',months:1,price:170,description:'Thursday 5:00 PM (Kids) / Saturday 10:15 AM · Forms, precision sparring & discipline',branchId:'dd',classes:['tkd-thu','tkd-sat'],active:true},
 {id:'hybrid-bjj',name:'Brazilian Jiu-Jitsu',months:1,price:170,description:'Sunday 9:30 AM · Professor Azrai',branchId:'dd',classes:['bjj-sun'],active:true},
];
export const enquiryServices=[{name:'Body Building',label:'1-on-1',description:'Personalized coaching · Functional hypertrophy, fat loss & reset'},{name:'Arm Wrestling',label:'Specialty',description:'Technique & table time · Grip strength, positioning & tournament prep'}];

// A one-time, non-destructive upgrade for browsers that already have demo records.
// Paid amounts and historical memberships are deliberately preserved.
export function upgradeDemoCatalogue(db:Database):Database {
 return {...db,
  plans:[...db.plans.map(p=>['p1','p2','p3'].includes(p.id)?{...p,active:false}:p),...academyPlans.filter(p=>!db.plans.some(old=>old.id===p.id))],
  classes:[...db.classes.map(c=>academyClasses.find(a=>a.id===c.id)||c),...academyClasses.filter(c=>!db.classes.some(old=>old.id===c.id))],
 };
}
