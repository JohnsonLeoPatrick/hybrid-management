'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, CheckCircle2, ChevronRight, Dumbbell, Search, Users, Loader2, X, LogIn } from 'lucide-react';
import type { Database, Member } from '@/types';
import { checkIn, searchMembers } from '@/lib/attendance';
import { memberStatus, today } from '@/lib/utils';

export function MemberCheckIn({db,members,save,busy,open}:{db:Database;members:Member[];save:(db:Database)=>Promise<boolean>;busy:boolean;open:(kind:string,member:Member)=>void}) {
 const [query,setQuery] = useState('');
 const [selectedId,setSelectedId] = useState('');
 const [kind,setKind] = useState<'gym'|'class'>('gym');
 const [classId,setClassId] = useState('');
 const [pending,setPending] = useState(false);
 const [message,setMessage] = useState('');
 const [error,setError] = useState('');
 const lock = useRef(false);
 const searchRef = useRef<HTMLInputElement>(null);
 const restoreFocus = useRef(false);
 useEffect(()=>{
  if (restoreFocus.current && !pending && !busy) {
   restoreFocus.current=false;
   searchRef.current?.focus();
  }
 },[pending,busy]);
 const selected = members.find(member => member.id === selectedId);
 const matches = searchMembers(members,query);
 const classes = selected ? db.classes.filter(item => item.branchId === selected.branchId && selected.classIds.includes(item.id)) : [];
 const visitClass = kind === 'gym' ? null : classId;
 const date = today();
 const arrivals = db.attendance.filter(item => item.date === date && members.some(member => member.id === item.memberId));
 const duplicate = !!selected && arrivals.some(item => item.memberId === selected.id && item.classId === visitClass);
 const membership = selected ? memberStatus(db,selected.id) : '';
 const unavailable = pending || busy;
 const initials = (name:string) => name.split(' ').map(part=>part[0]).slice(0,2).join('');

 return <section className="check-in-panel panel" aria-labelledby="check-in-title">
  <div className="check-in-main">
   <div className="check-in-heading"><span className="check-in-mark"><LogIn size={23} aria-hidden="true"/></span><div><span className="check-in-eyebrow">READY WHEN THEY ARE</span><h2 id="check-in-title">Member check-in</h2><p>Find a member. Get them moving.</p></div></div>
   <form onSubmit={async event=>{
    event.preventDefault();
    if (!selected || lock.current || unavailable || (kind === 'class' && !classId)) return;
    lock.current=true;setPending(true);setError('');setMessage('');
    try {
     const next=checkIn(db,selected.id,visitClass);
     if (await save(next)) {
      setMessage(`${selected.name} checked in for ${kind==='gym'?'a gym visit':classes.find(item=>item.id===classId)?.name || 'class attendance'}.`);
      restoreFocus.current=true;
      setSelectedId('');setQuery('');setClassId('');
     } else setError('Check-in was not saved. Please retry. If another staff member checked them in, refresh to see the latest arrivals.');
    } catch(cause) {setError(cause instanceof Error ? cause.message : 'Could not check in. Please try again.');}
    finally {lock.current=false;setPending(false);}
   }}>
    <label className="check-in-label" htmlFor="check-in-search">Find a member</label>
    <div className="search check-in-search"><Search size={19} aria-hidden="true"/><input ref={searchRef} id="check-in-search" type="search" placeholder="Member ID, name or phone number" autoComplete="off" value={query} disabled={unavailable} onChange={event=>{setQuery(event.target.value);setSelectedId('');setClassId('');setError('');setMessage('');}}/></div>
    {!selected && query.trim() && <div className="check-in-results" aria-label="Matching members"><p className="check-in-result-count" role="status">{matches.length ? `${matches.length} matching ${matches.length===1?'member':'members'}${matches.length>8?' · showing first 8, refine your search':''}` : 'No members found. Try another ID, name or phone number.'}</p>{matches.slice(0,8).map(member=><button type="button" className="check-in-result" key={member.id} disabled={unavailable} onClick={()=>{setSelectedId(member.id);setClassId('');setError('');}}><span className="avatar">{initials(member.name)}</span><span><b>{member.name}</b><small>{member.id} · {member.phone || 'No phone number'}</small></span><ChevronRight size={18} aria-hidden="true"/></button>)}</div>}
    {selected ? <>
     <div className="check-in-selected"><span className="avatar">{initials(selected.name)}</span><div><b>{selected.name}</b><small>{selected.id}</small></div><span className="check-in-membership">{membership.toLowerCase().replaceAll('_',' ')}</span><button type="button" className="icon-button" aria-label="Choose another member" disabled={unavailable} onClick={()=>{setSelectedId('');setQuery('');setClassId('');searchRef.current?.focus();}}><X size={18}/></button></div>
     {!['ACTIVE','EXPIRING SOON'].includes(membership) && <p className="check-in-warning">Membership is {membership.toLowerCase()}. Review their membership before admitting them. <button type="button" className="text-button" onClick={()=>open('profile',selected)}>View profile</button></p>}
     <fieldset className="check-in-types" disabled={unavailable}><legend>Visit type</legend><label className={kind==='gym'?'is-selected':''}><input type="radio" name="visit-type" value="gym" checked={kind==='gym'} onChange={()=>{setKind('gym');setError('');}}/><Dumbbell size={20} aria-hidden="true"/><span><b>Gym visit</b><small>Open training</small></span>{kind==='gym'&&<Check size={17} aria-hidden="true"/>}</label><label className={kind==='class'?'is-selected':''}><input type="radio" name="visit-type" value="class" checked={kind==='class'} onChange={()=>{setKind('class');setError('');}}/><Users size={20} aria-hidden="true"/><span><b>Class attendance</b><small>Enrolled classes</small></span>{kind==='class'&&<Check size={17} aria-hidden="true"/>}</label></fieldset>
     {kind==='class' && <label className="field check-in-class">Choose a class<select value={classId} required disabled={unavailable || !classes.length} onChange={event=>{setClassId(event.target.value);setError('');}}><option value="">{classes.length?'Select an enrolled class':'No enrolled classes'}</option>{classes.map(item=><option key={item.id} value={item.id}>{item.name} · {item.day} {item.start.slice(0,5)}</option>)}</select>{!classes.length&&<span>Enroll this member in a class from their <button type="button" className="text-button" onClick={()=>open('profile',selected)}>member profile</button>.</span>}</label>}
     <button type="submit" className="primary check-in-submit" disabled={unavailable || duplicate || (kind==='class'&&!classId)}>{pending?<Loader2 size={18} className="check-in-spinner" aria-hidden="true"/>:<CheckCircle2 size={18} aria-hidden="true"/>}{pending?'Saving check-in…':duplicate?'Already checked in today':kind==='gym'?'Check in for gym visit':'Check in for class'}</button>
    </> : !query.trim() && <div className="check-in-prompt"><span><Dumbbell size={17} aria-hidden="true"/> Gym visits</span><span><Users size={17} aria-hidden="true"/> Class attendance</span><p>Search above to check in an existing member.</p></div>}
    <div role="status" aria-live="polite">{message&&<p className="check-in-success"><CheckCircle2 size={18} aria-hidden="true"/>{message}</p>}</div>{error&&<p className="check-in-error" role="alert">{error}</p>}
   </form>
  </div>
  <aside className="check-in-today" aria-label="Today's arrivals"><div className="check-in-today-heading"><div><span className="check-in-eyebrow">TODAY AT RECEPTION</span><h3>Today’s arrivals</h3></div><span className="check-in-count">{arrivals.length}</span></div><p className="check-in-date">{new Intl.DateTimeFormat('en-MY',{dateStyle:'full',timeZone:'Asia/Kuala_Lumpur'}).format(new Date(date+'T12:00:00+08:00'))}</p><div className="check-in-arrivals">{arrivals.slice().reverse().slice(0,6).map(item=>{const member=members.find(value=>value.id===item.memberId)!;return <button type="button" className="check-in-arrival" key={item.id} onClick={()=>open('profile',member)}><span className="avatar">{initials(member.name)}</span><span><b>{member.name}</b><small>{item.classId===null?'Gym visit':db.classes.find(value=>value.id===item.classId)?.name || 'Archived class'}</small></span><CheckCircle2 size={17} aria-hidden="true"/></button>})}{!arrivals.length&&<div className="check-in-empty"><Users size={28} aria-hidden="true"/><b>A fresh start.</b><p>Today’s check-ins appear here as members arrive.</p></div>}</div><p className="check-in-footnote">{new Set(arrivals.map(item=>item.memberId)).size} members checked in · Malaysia time</p></aside>
 </section>;
}
