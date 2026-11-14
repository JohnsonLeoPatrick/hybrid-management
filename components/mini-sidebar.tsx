'use client';

import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { ChevronRight, FolderLock, PanelLeftOpen, type LucideIcon } from 'lucide-react';

type NavigationItem = { page: string; label: string; href: string; Icon: LucideIcon };
const administration = new Set(['Branches', 'Reports', 'Staff', 'Settings']);

export function MiniSidebar({items,currentPage,onNavigate,onExpand,initials}:{items:NavigationItem[];currentPage:string;onNavigate:(page:string)=>void;onExpand:()=>void;initials:string}) {
 const [open,setOpen]=useState(false);
 const edge=useRef<HTMLButtonElement>(null);
 const folder=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{if(!open&&folder.current)folder.current.open=false;},[open]);
 const follow=(event:MouseEvent<HTMLAnchorElement>,page:string)=>{
  if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  event.preventDefault();setOpen(false);onNavigate(page);
 };
 const adminItems=items.filter(item=>administration.has(item.page));
 return <>
  <button ref={edge} className="sidebar-edge-trigger" aria-label="Show quick navigation" aria-controls="quick-navigation" aria-expanded={open} onPointerEnter={event=>{if(event.pointerType==='mouse')setOpen(true);}} onClick={()=>setOpen(value=>!value)}><ChevronRight size={16} aria-hidden="true"/></button>
  <aside id="quick-navigation" className={'mini-sidebar'+(open?' is-open':'')} aria-label="Quick navigation" aria-hidden={!open} inert={!open} onMouseEnter={()=>setOpen(true)} onMouseLeave={event=>{if(!event.currentTarget.contains(document.activeElement))setOpen(false);}} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setOpen(false);}} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();setOpen(false);edge.current?.focus();}}}>
   <button className="mini-pin" aria-label="Pin sidebar open" onClick={onExpand}><PanelLeftOpen size={22} aria-hidden="true"/><span className="mini-tooltip">Keep sidebar open</span></button>
   <nav aria-label="Quick page navigation">{items.filter(item=>!administration.has(item.page)).map(({page,label,href,Icon})=><a key={page} href={href} aria-label={label} aria-current={page===currentPage?'page':undefined} onClick={event=>follow(event,page)}><Icon size={20} strokeWidth={1.7} aria-hidden="true"/><span className="mini-tooltip">{label}</span></a>)}
    {!!adminItems.length&&<details ref={folder} className="mini-admin-folder"><summary aria-label="Administration"><FolderLock size={20} aria-hidden="true"/><span className="mini-tooltip">Administration</span></summary><div className="mini-admin-links">{adminItems.map(({page,label,href,Icon})=><a key={page} href={href} aria-current={page===currentPage?'page':undefined} onClick={event=>follow(event,page)}><Icon size={18} aria-hidden="true"/><span>{label}</span></a>)}</div></details>}
   </nav>
   <button className="mini-profile" aria-label="Open full sidebar and account controls" onClick={onExpand}><span>{initials}</span><span className="mini-tooltip">Account &amp; sign out</span></button>
  </aside>
 </>;
}
