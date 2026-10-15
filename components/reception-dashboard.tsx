import { Plus, RefreshCw, CreditCard, ChevronRight, Users, Clock, Shield } from 'lucide-react';
import { Database, Member } from '@/types';
import { current, daysLeft, status, today } from '@/lib/utils';
import { Badge } from './gym-app';

export function ReceptionDashboard({db,members,open,navigate,canReport}:{db:Database;members:Member[];open:(kind:string,m?:Member|null)=>void;navigate:(p:string)=>void;canReport:boolean}){
 const expiring=members.filter(m=>status(current(db,m.id))==='EXPIRING SOON').sort((a,b)=>current(db,a.id).expiry.localeCompare(current(db,b.id).expiry));
 const unpaid=db.payments.filter(p=>p.status!=='Paid'&&members.some(m=>m.id===p.memberId));
 return <>
  <section className="reception-actions" aria-label="Reception shortcuts">
   <button onClick={()=>open('member')}><span className="action-icon"><Plus/></span><span><b>Add a member</b><small>Choose a class and get them started</small></span><ChevronRight/></button>
   <button onClick={()=>navigate('Renewals')}><span className="action-icon"><RefreshCw/></span><span><b>Renew a membership</b><small>Find a member and extend their plan</small></span><ChevronRight/></button>
   <button onClick={()=>open('payment')}><span className="action-icon"><CreditCard/></span><span><b>Record a payment</b><small>Save a payment in a few clicks</small></span><ChevronRight/></button>
  </section>
  <div className="simple-stats">{[
   {label:'Total members',value:members.length,Icon:Users,page:'Members'},
   {label:'Active members',value:members.filter(m=>['ACTIVE','EXPIRING SOON'].includes(status(current(db,m.id)))).length,Icon:Shield,page:'Members'},
   {label:'Expiring in 30 days',value:expiring.length,Icon:Clock,page:'Renewals'},
   {label:'Unsettled payments',value:unpaid.length,Icon:CreditCard,page:'Payments'},
  ].map(({label,value,Icon,page})=><button className="stat-card" key={label} onClick={()=>navigate(page)}><div className="stat-top">{label}<Icon size={19}/></div><strong>{value}</strong></button>)}</div>
  <section className="panel"><div className="panel-heading"><div><h2>Memberships that need attention</h2><p>Start with the members whose plans expire next.</p></div><button className="text-button" onClick={()=>navigate('Renewals')}>See all <ChevronRight size={16}/></button></div>
   {expiring.slice(0,5).map(m=><div className="attention-row" key={m.id}><button className="member-cell" onClick={()=>open('profile',m)}><span className="avatar">{m.name.split(' ').map(n=>n[0]).slice(0,2).join('')}</span><span><b>{m.name}</b><small>{db.plans.find(p=>p.id===current(db,m.id)?.planId)?.name}</small></span></button><span className="expiry-note">{daysLeft(current(db,m.id).expiry)===0?'Expires today':`${daysLeft(current(db,m.id).expiry)} days left`}<small>{current(db,m.id).expiry}</small></span><button className="primary" onClick={()=>open('renew',m)}>Renew</button></div>)}
   {!expiring.length&&<div className="empty">All caught up. No memberships are expiring in the next 30 days.</div>}
  </section>
  <section className="panel"><div className="panel-heading"><div><h2>Latest members</h2><p>Your most recent registrations.</p></div><button className="text-button" onClick={()=>navigate('Members')}>All members <ChevronRight size={16}/></button></div>{members.slice().sort((a,b)=>b.registered.localeCompare(a.registered)).slice(0,4).map(m=><button className="activity-row" key={m.id} onClick={()=>open('profile',m)}><span className="avatar">{m.name.split(' ').map(n=>n[0]).slice(0,2).join('')}</span><span><b>{m.name}</b><small>{m.registered===today()?'Joined today':m.registered}</small></span><span className="latest-status"><Badge value={status(current(db,m.id))}/><ChevronRight size={16}/></span></button>)}</section>
  {canReport&&<p className="home-help">Need charts or a detailed breakdown? Open <button className="text-button" onClick={()=>navigate('Reports')}>More tools → Reports</button>.</p>}
 </>;
}
