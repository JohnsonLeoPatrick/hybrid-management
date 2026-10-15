import { Database } from '@/types';
import { addMonths, today } from './utils';
import { academyClasses, academyPlans } from './catalogue';
export function seed(): Database {
const now=today(); const offset=(days:number)=>new Date(Date.parse(now)+days*86400000).toISOString().slice(0,10);
const names=['Amir Hakim','Sarah Tan','Daniel Lim','Nur Aisyah','Jason Wong','Priya Kumar','Farhan Azmi','Mei Ling','Adam Roslan','Sofia Hassan','Ryan Lee','Nadia Zain','Marcus Teoh','Aiman Yusuf','Chloe Ng','Hafiz Rahman','Emma Chong','Ravi Singh'];
return { branches:[{id:'dd',name:'Hybrid DD',code:'DD',address:'Desa Damansara, Kuala Lumpur',phone:'+60 3 2095 8800',active:true}],
plans:structuredClone(academyPlans),
classes:structuredClone(academyClasses),
members:names.map((name,i)=>({id:`HYB-DD-${String(i+1).padStart(5,'0')}`,name,ic:`900101${String(i).padStart(6,'0')}`,dob:'1995-04-12',gender:i%2?'Female':'Male',phone:`+60 12 345 ${String(6700+i)}`,email:name.toLowerCase().replace(' ','.')+'@example.com',emergencyName:'Emergency contact',emergencyPhone:'+60 12 888 9999',address:'Kuala Lumpur, Malaysia',registered:offset(-i*4),branchId:'dd',photo:'',medical:'',notes:'',coach:i%2?'Coach Daniel':'Coach Amir',classIds:[...academyPlans[i%academyPlans.length].classes]})),
memberships:names.map((_,i)=>({id:'ms'+i,memberId:`HYB-DD-${String(i+1).padStart(5,'0')}`,planId:academyPlans[i%academyPlans.length].id,start:offset(-40),expiry:i<3?offset(i*5+2):i<5?offset(-i):addMonths(now,2),state:i===17?'FROZEN':'NORMAL',created:offset(-40)+'T00:00:00Z'})),
payments:names.map((_,i)=>({id:'pay'+i,memberId:`HYB-DD-${String(i+1).padStart(5,'0')}`,membershipId:'ms'+i,amount:academyPlans[i%academyPlans.length].price,date:offset(-i*2),method:i%2?'Online Transfer':'Cash',reference:'HYB-'+(1040+i),notes:'',status:i===4?'Pending':i===7?'Partial':'Paid'})),renewals:[],attendance:[],staff:[{id:'demo',name:'Alex Morgan',email:'admin@hybrid.example',role:'SUPER ADMIN',branchId:'dd'}]}; }
