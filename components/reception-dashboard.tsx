'use client';

import { motion, MotionConfig } from 'motion/react';
import { Plus, RefreshCw, CreditCard, ChevronRight, Users, Clock, Shield } from 'lucide-react';
import { Database, Member } from '@/types';
import { currentMemberships, memberStatus, daysLeft, status, today } from '@/lib/utils';
import { Badge } from './gym-app';
import { MembershipChart } from './membership-chart';

const cardMotion = {
 whileHover: { y: -3 },
 whileTap: { scale: .985 },
 transition: { type: 'spring' as const, stiffness: 380, damping: 30 },
};

export function ReceptionDashboard({db,members,open,navigate,canReport,paymentUnlocked}:{db:Database;members:Member[];open:(kind:string,m?:Member|null)=>void;navigate:(p:string)=>void;canReport:boolean;paymentUnlocked:boolean}){
 const expiring=members.flatMap(m=>currentMemberships(db,m.id).map(ms=>({m,ms}))).filter(({ms})=>status(ms)==='EXPIRING SOON').sort((a,b)=>a.ms.expiry.localeCompare(b.ms.expiry));
 const unpaid=db.payments.filter(p=>p.status!=='Paid'&&members.some(m=>m.id===p.memberId));
 return <MotionConfig reducedMotion="user"><div className="dashboard-layout">
  <div className="dashboard-section-label"><span>YOUR ACADEMY AT A GLANCE</span><span>Live overview</span></div>
  <div className="simple-stats">{[
   {label:'Total members',value:members.length,Icon:Users,page:'Members',detail:'Your academy community'},
   {label:'Active members',value:members.filter(m=>['ACTIVE','EXPIRING SOON'].includes(memberStatus(db,m.id))).length,Icon:Shield,page:'Members',detail:'Active and expiring memberships'},
   {label:'Expiring in 30 days',value:expiring.length,Icon:Clock,page:'Renewals',detail:'Memberships to follow up'},
   {label:'Unsettled payments',value:paymentUnlocked?unpaid.length:'Locked',Icon:CreditCard,page:'Payments',detail:'Outstanding payment records'},
  ].map(({label,value,Icon,page,detail},index)=><motion.button {...cardMotion} className={'stat-card metric-'+index} key={label} onClick={()=>navigate(page)}><div className="stat-top">{label}<span className="metric-icon"><Icon size={18}/></span></div><strong>{value.toLocaleString()}</strong><div className="metric-caption">{detail}<ChevronRight size={14}/></div></motion.button>)}</div>
  <div className="dashboard-section-label"><span>FRONT DESK</span><span>Everyday essentials</span></div>
  <section className="reception-actions" aria-label="Reception shortcuts">
   <motion.button {...cardMotion} onClick={()=>open('member')}><span className="action-icon"><Plus/></span><span><b>Add a member</b><small>Choose a class and get them started</small></span><ChevronRight/></motion.button>
   <motion.button {...cardMotion} onClick={()=>navigate('Renewals')}><span className="action-icon"><RefreshCw/></span><span><b>Renew a membership</b><small>Find a member and extend their plan</small></span><ChevronRight/></motion.button>
   <motion.button {...cardMotion} onClick={()=>open('payment')}><span className="action-icon"><CreditCard/></span><span><b>Record a payment</b><small>Save a payment in a few clicks</small></span><ChevronRight/></motion.button>
  </section>
  <div className="dashboard-insights">
  <MembershipChart db={db} members={members}/>
  <section className="panel"><div className="panel-heading"><div><h2>Memberships that need attention</h2><p>Start with the members whose plans expire next.</p></div><button className="text-button" onClick={()=>navigate('Renewals')}>See all <ChevronRight size={16}/></button></div>
   {expiring.slice(0,5).map(({m,ms})=><div className="attention-row" key={ms.id}><button className="member-cell" onClick={()=>open('profile',m)}><span className="avatar">{m.name.split(' ').map(n=>n[0]).slice(0,2).join('')}</span><span><b>{m.name}</b><small>{db.plans.find(p=>p.id===ms.planId)?.name}</small></span></button><span className="expiry-note">{daysLeft(ms.expiry)===0?'Expires today':`${daysLeft(ms.expiry)} days left`}<small>{ms.expiry}</small></span><button className="primary" onClick={()=>open('renew:'+ms.planId,m)}>Renew</button></div>)}
   {!expiring.length&&<div className="empty">All caught up. No memberships are expiring in the next 30 days.</div>}
  </section>
  </div>
  <section className="panel latest-members"><div className="panel-heading"><div><h2>Latest members</h2><p>A growing community. Your newest registrations.</p></div><button className="text-button" onClick={()=>navigate('Members')}>All members <ChevronRight size={16}/></button></div>{members.slice().sort((a,b)=>b.registered.localeCompare(a.registered)).slice(0,4).map(m=><button className="activity-row" key={m.id} onClick={()=>open('profile',m)}><span className="avatar">{m.name.split(' ').map(n=>n[0]).slice(0,2).join('')}</span><span><b>{m.name}</b><small>{m.registered===today()?'Joined today':m.registered}</small></span><span className="latest-status"><Badge value={memberStatus(db,m.id)}/><ChevronRight size={16}/></span></button>)}{!members.length&&<div className="empty">Your community starts here. Add your first member to get going.</div>}</section>
  {canReport&&<p className="home-help">Need charts or a detailed breakdown? Open <button className="text-button" onClick={()=>navigate('Reports')}>More tools → Reports</button>.</p>}
 </div></MotionConfig>;
}
