'use client';

import { useId, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Database, Member } from '@/types';
import { currentMemberships, memberStatus } from '@/lib/utils';

const categories = [
 { key: 'ACTIVE', label: 'Active', color: '#f0c92c' },
 { key: 'EXPIRING SOON', label: 'Expiring soon', color: '#e0e0e0' },
 { key: 'UPCOMING', label: 'Upcoming', color: '#a5a5a5' },
 { key: 'FROZEN', label: 'Frozen', color: '#858585' },
 { key: 'EXPIRED', label: 'Expired', color: '#686868' },
 { key: 'CANCELLED', label: 'Cancelled', color: '#494949' },
 { key: 'NONE', label: 'No membership', color: '#bfbfbf' },
];

export function MembershipChart({ db, members }: { db: Database; members: Member[] }) {
 const [selected, setSelected] = useState<string | null>(null);
 const [hovered, setHovered] = useState<string | null>(null);
 const [focused, setFocused] = useState<string | null>(null);
 const [showAll, setShowAll] = useState(false);
 const reduceMotion = useReducedMotion();
 const legendId = useId();
 const counts = new Map<string, number>();
 for (const member of members) {
  const key = currentMemberships(db, member.id).length ? memberStatus(db, member.id) : 'NONE';
  counts.set(key, (counts.get(key) || 0) + 1);
 }
 let offset = 0;
 const slices = categories.map(category => {
  const count = counts.get(category.key) || 0;
  const share = members.length ? count / members.length * 100 : 0;
  const slice = { ...category, count, share, offset };
  offset += share;
  return slice;
 });
 const populated = slices.filter(slice => slice.count > 0);
 const visible = showAll || !members.length ? slices : populated;
 const active = slices.find(slice => slice.key === (hovered ?? focused ?? selected));
 const percent = (share: number) => `${Number(share.toFixed(1))}%`;
 return <section className="panel membership-overview" aria-label="Membership status breakdown">
  <div className="panel-heading"><div><h2>Membership status</h2></div></div>
  <div className="status-chart">
   <div className="status-chart-visual">
    <div className="status-donut">
     <svg viewBox="0 0 220 220" role="img" aria-label={`${members.length} members. ${populated.map(slice => `${slice.label}: ${slice.count}, ${percent(slice.share)}`).join('. ')}`}>
      <circle className="status-donut-track" cx="110" cy="110" r="82" fill="none" strokeWidth="18"/>
      <g transform="rotate(-90 110 110)">
       {populated.map(slice => {
        const gap = populated.length > 1 ? Math.min(1.8, slice.share * .18) : 0;
        return <motion.circle key={slice.key} cx="110" cy="110" r="82" pathLength="100" fill="none" stroke={slice.color} strokeWidth="18" strokeDasharray={`${slice.share - gap} ${100 - slice.share + gap}`} strokeDashoffset={-slice.offset - gap / 2} initial={false} animate={{opacity: active && active.key !== slice.key ? .45 : 1, strokeWidth: active?.key === slice.key ? 22 : 18}} transition={{duration: reduceMotion ? 0 : .18}} onPointerEnter={event=>{if(event.pointerType==='mouse')setHovered(slice.key)}} onPointerLeave={()=>setHovered(null)}><title>{slice.label}: {slice.count} ({percent(slice.share)})</title></motion.circle>;
       })}
      </g>
     </svg>
     <div className="status-donut-center"><strong>{members.length.toLocaleString()}</strong><span>{members.length === 1 ? 'member' : 'members'}</span></div>
    </div>
    <div className="status-chart-summary" role="status" aria-atomic="true">{active ? <><i style={{background:active.color}}/>{active.label}<b>{percent(active.share)}</b></> : <span>{members.length ? '' : 'No members yet'}</span>}</div>
   </div>
   <div className="status-chart-details">
    <div className="status-legend-heading" aria-hidden="true"><span>Status</span><span>Members</span><span>Share</span></div>
    <div id={legendId} className="status-legend" aria-label="Membership status counts">
     {visible.map(slice=><button type="button" key={slice.key} className={active?.key === slice.key ? 'is-highlighted' : ''} aria-pressed={selected === slice.key} aria-label={`${slice.label}: ${slice.count} members, ${percent(slice.share)}`} onPointerEnter={event=>{if(event.pointerType==='mouse')setHovered(slice.key)}} onPointerLeave={()=>setHovered(null)} onFocus={()=>setFocused(slice.key)} onBlur={()=>setFocused(null)} onClick={()=>setSelected(selected === slice.key ? null : slice.key)} onKeyDown={event=>{if(event.key==='Escape'){setSelected(null);setFocused(null)}}}><span className="status-legend-name"><i style={{background:slice.color}}/>{slice.label}</span><b>{slice.count}</b><span className="status-legend-share">{percent(slice.share)}</span></button>)}
    </div>
    {members.length > 0 && populated.length < slices.length && <button type="button" className="status-show-all" aria-expanded={showAll} aria-controls={legendId} onClick={()=>{setShowAll(!showAll);setSelected(null)}}>{showAll ? 'Hide empty statuses' : `Show all ${slices.length} statuses`}</button>}
   </div>
  </div>
 </section>;
}
