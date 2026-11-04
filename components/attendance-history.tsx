'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, History, Loader2, RefreshCw } from 'lucide-react';
import type { Member } from '@/types';
import { attendanceHistoryPageSize, loadAttendanceHistory, type AttendanceHistoryRow } from '@/services/attendance-history';

export function AttendanceHistory({branch,members,revision}:{branch:string;members:Member[];revision:number}) {
 const [expanded,setExpanded]=useState(false);
 const [from,setFrom]=useState('');
 const [to,setTo]=useState('');
 const [memberId,setMemberId]=useState('all');
 const [kind,setKind]=useState<'all'|'gym'|'class'>('all');
 const [page,setPage]=useState(0);
 const [refresh,setRefresh]=useState(0);
 const [rows,setRows]=useState<AttendanceHistoryRow[]>([]);
 const [count,setCount]=useState(0);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>{
  if (!expanded) return;
  const controller=new AbortController();
  setLoading(true);setError('');setRows([]);setCount(0);
  void loadAttendanceHistory({branch,from,to,memberId,kind,page},controller.signal).then(result=>{
   if (controller.signal.aborted) return;
   const lastPage=Math.max(0,Math.ceil(result.count/attendanceHistoryPageSize)-1);
   if (page>lastPage) {setPage(lastPage);return;}
   setRows(result.rows);setCount(result.count);
  }).catch(cause=>{
   if (!controller.signal.aborted) setError(cause instanceof Error?cause.message:typeof cause?.message==='string'?cause.message:'Could not load history. Please retry.');
  }).finally(()=>{if (!controller.signal.aborted) setLoading(false);});
  return ()=>controller.abort();
 },[expanded,branch,from,to,memberId,kind,page,refresh,revision]);
 const totalPages=Math.max(1,Math.ceil(count/attendanceHistoryPageSize));
 return <section className="panel attendance-history" aria-labelledby="attendance-history-title">
  <div className="panel-heading"><div><h2 id="attendance-history-title"><History size={19} aria-hidden="true"/>Check-in history</h2><p>Past gym visits and class attendance, saved in Supabase.</p></div><button type="button" className="secondary" aria-expanded={expanded} aria-controls="attendance-history-content" onClick={()=>setExpanded(value=>!value)}>{expanded?'Hide history':'View history'}<ChevronDown size={17} aria-hidden="true"/></button></div>
  <div id="attendance-history-content" hidden={!expanded} aria-busy={loading}>
   <div className="attendance-history-filters"><label className="field">From date<input type="date" value={from} max={to||undefined} onChange={event=>{setFrom(event.target.value);setPage(0);}}/></label><label className="field">To date<input type="date" value={to} min={from||undefined} onChange={event=>{setTo(event.target.value);setPage(0);}}/></label><label className="field">Member<select value={memberId} onChange={event=>{setMemberId(event.target.value);setPage(0);}}><option value="all">All members</option>{members.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(member=><option key={member.id} value={member.id}>{member.name} · {member.id}</option>)}</select></label><label className="field">Visit type<select value={kind} onChange={event=>{setKind(event.target.value as typeof kind);setPage(0);}}><option value="all">All visits</option><option value="gym">Gym visits</option><option value="class">Class attendance</option></select></label></div>
   <div className="attendance-history-tools"><p>Leave dates empty to see all saved history. Dates use Malaysia time.</p><div><button type="button" className="text-button" onClick={()=>{setFrom('');setTo('');setMemberId('all');setKind('all');setPage(0);}}>Clear filters</button><button type="button" className="secondary" disabled={loading} onClick={()=>setRefresh(value=>value+1)}><RefreshCw size={16} aria-hidden="true"/>Refresh</button></div></div>
   <div aria-live="polite" role="status" className="attendance-history-status">{loading?<><Loader2 size={17} aria-hidden="true"/>Loading saved check-ins…</>:!error?`${count} saved ${count===1?'check-in':'check-ins'} match your filters.`:''}</div>
   {error?<p className="check-in-error" role="alert">{error}</p>:!loading&&<><div className="attendance-history-table"><table><caption className="sr-only">Stored gym visits and class attendance, newest dates first</caption><thead><tr><th scope="col">Date</th><th scope="col">Member</th><th scope="col">Visit</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td><time dateTime={row.date}>{new Intl.DateTimeFormat('en-MY',{dateStyle:'medium',timeZone:'Asia/Kuala_Lumpur'}).format(new Date(row.date+'T12:00:00+08:00'))}</time></td><td><b>{row.members.name}</b><small>{row.memberId}</small></td><td>{row.classId===null?'Gym visit':row.classes?.name || 'Archived class'}<small>{row.classId===null?'Open training':'Class attendance'}</small></td></tr>)}</tbody></table></div>{!rows.length&&<div className="empty">No check-ins found for these filters. Try another date range or clear the filters.</div>}<div className="attendance-history-pagination"><span>Page {page+1} of {totalPages}</span><div><button type="button" className="secondary" disabled={page===0} onClick={()=>setPage(value=>value-1)}><ChevronLeft size={16} aria-hidden="true"/>Previous</button><button type="button" className="secondary" disabled={page+1>=totalPages} onClick={()=>setPage(value=>value+1)}>Next<ChevronRight size={16} aria-hidden="true"/></button></div></div></>}
  </div>
 </section>;
}
