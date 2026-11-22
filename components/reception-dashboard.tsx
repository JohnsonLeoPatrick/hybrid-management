'use client';

import { motion, MotionConfig } from 'motion/react';
import { Plus, RefreshCw, CreditCard, ChevronRight, ArrowUpRight, Users, ShieldCheck, Clock3, LockKeyhole } from 'lucide-react';
import { Database, Member } from '@/types';
import { currentMemberships, memberStatus, daysLeft, status, today } from '@/lib/utils';
import { Badge } from './gym-app';
import { MembershipChart } from './membership-chart';
import { MemberCheckIn } from './member-check-in';
import { AttendanceHistory } from './attendance-history';
import { RetailPayment } from './retail-payment';

const cardMotion = {
 whileTap: { scale: .995 },
 transition: { duration: .15 },
};

export function ReceptionDashboard({db,members,open,navigate,paymentUnlocked,save,busy,branch,refresh}:{db:Database;members:Member[];open:(kind:string,m?:Member|null)=>void;navigate:(p:string)=>void;paymentUnlocked:boolean;save:(db:Database)=>Promise<boolean>;busy:boolean;branch:string;refresh:()=>Promise<void>}){
 const expiring=members.flatMap(m=>currentMemberships(db,m.id).map(ms=>({m,ms}))).filter(({ms})=>status(ms)==='EXPIRING SOON').sort((a,b)=>a.ms.expiry.localeCompare(b.ms.expiry));
 const activeCount=members.filter(m=>['ACTIVE','EXPIRING SOON'].includes(memberStatus(db,m.id))).length;
 const activeShare=members.length?Math.round(activeCount/members.length*100):0;
 const unpaid=db.payments.filter(p=>p.status!=='Paid'&&!['Void','Refunded'].includes(p.status)&&members.some(m=>m.id===p.memberId));
 return <MotionConfig reducedMotion="user"><div className="dashboard-layout">
  <MemberCheckIn key={branch} {...{db,members,save,busy,open}}/>
  <AttendanceHistory key={'history-'+branch} branch={branch} members={members} revision={db.attendance.length}/>
  <div className="dashboard-section-label"><span>Members</span></div>
  <div className="simple-stats summary-grid" aria-label="Membership summary">{[
   {label:'Total members',value:members.length,page:'Members',Icon:Users},
   {label:'Active members',value:activeCount,page:'Members',Icon:ShieldCheck},
   {label:'Plans expiring in 30 days',value:expiring.length,page:'Renewals',Icon:Clock3},
   {label:'Unsettled payments',value:paymentUnlocked?unpaid.length:'Locked',page:'Payments',Icon:paymentUnlocked?CreditCard:LockKeyhole},
  ].map(({label,value,page,Icon},index)=><motion.button {...cardMotion} className={'stat-card metric-'+index} key={label} onClick={()=>navigate(page)}>
   <span className="summary-card-top"><span className="summary-icon"><Icon size={22} strokeWidth={1.7} aria-hidden="true"/></span><ArrowUpRight size={19} aria-hidden="true"/></span>
   <span className="stat-top">{label}</span>
   <span className="summary-value"><strong>{value.toLocaleString()}</strong>{index===1&&<span className="summary-share">{activeShare}%</span>}</span>
   {index===1&&<span className="summary-progress" role="meter" aria-label="Active member share" aria-valuemin={0} aria-valuemax={100} aria-valuenow={activeShare}><span style={{transform:`scaleX(${activeShare/100})`}}/></span>}
  </motion.button>)}</div>
  <div className="dashboard-section-label"><span>Quick actions</span></div>
  <section className="reception-actions" aria-label="Reception shortcuts">
   <RetailPayment key={branch} branch={branch} refresh={refresh} shortcut/>
   <motion.button {...cardMotion} onClick={()=>open('member')}><span className="action-icon"><Plus size={18} strokeWidth={1.5}/></span><span><b>Add a member</b></span><ChevronRight size={16}/></motion.button>
   <motion.button {...cardMotion} onClick={()=>navigate('Renewals')}><span className="action-icon"><RefreshCw size={18} strokeWidth={1.5}/></span><span><b>Renew a membership</b></span><ChevronRight size={16}/></motion.button>
   <motion.button {...cardMotion} onClick={()=>open('payment')}><span className="action-icon"><CreditCard size={18} strokeWidth={1.5}/></span><span><b>Record a payment</b></span><ChevronRight size={16}/></motion.button>
  </section>
  <div className="dashboard-insights">
  <MembershipChart db={db} members={members}/>
  <section className="panel"><div className="panel-heading"><div><h2>Upcoming renewals</h2></div><button className="text-button" onClick={()=>navigate('Renewals')}>See all <ChevronRight size={16}/></button></div>
   {expiring.slice(0,5).map(({m,ms})=><div className="attention-row" key={ms.id}><button className="member-cell" onClick={()=>open('profile',m)}><span className="avatar">{m.name.split(' ').map(n=>n[0]).slice(0,2).join('')}</span><span><b>{m.name}</b><small>{db.plans.find(p=>p.id===ms.planId)?.name}</small></span></button><span className="expiry-note">{daysLeft(ms.expiry)===0?'Expires today':`${daysLeft(ms.expiry)} days left`}<small>{ms.expiry}</small></span><button className="primary" onClick={()=>open('renew:'+ms.planId,m)}>Renew</button></div>)}
   {!expiring.length&&<div className="empty">No memberships expire in the next 30 days.</div>}
  </section>
  </div>
  <section className="panel latest-members"><div className="panel-heading"><div><h2>Latest members</h2></div><button className="text-button" onClick={()=>navigate('Members')}>All members <ChevronRight size={16}/></button></div>{members.slice().sort((a,b)=>b.registered.localeCompare(a.registered)).slice(0,4).map(m=><button className="activity-row" key={m.id} onClick={()=>open('profile',m)}><span className="avatar">{m.name.split(' ').map(n=>n[0]).slice(0,2).join('')}</span><span><b>{m.name}</b><small>{m.registered===today()?'Joined today':m.registered}</small></span><span className="latest-status"><Badge value={memberStatus(db,m.id)}/><ChevronRight size={16}/></span></button>)}{!members.length&&<div className="empty">No members yet. Add a member to start.</div>}</section>
 </div></MotionConfig>;
}
