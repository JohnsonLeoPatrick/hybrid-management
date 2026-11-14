'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { ChevronRight, FolderLock, X } from 'lucide-react';

export function AdministrationFolder({children,current}:{children:ReactNode;current:boolean}) {
 const folder=useRef<HTMLDetailsElement>(null);
 const close=(restoreFocus=false)=>{
  const element=folder.current;
  if(!element?.open)return;
  element.open=false;
  if(restoreFocus)element.querySelector('summary')?.focus();
 };
 useEffect(()=>{
  const outside=(event:PointerEvent)=>{
   if(event.target instanceof Node&&!folder.current?.contains(event.target))close();
  };
  const escape=(event:KeyboardEvent)=>{
   if(event.key==='Escape'&&folder.current?.open&&!document.querySelector('.modal[role="dialog"]')){
    event.preventDefault();event.stopImmediatePropagation();close(true);
   }
  };
  document.addEventListener('pointerdown',outside);
  document.addEventListener('keydown',escape,true);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape,true);};
 },[]);
 return <details ref={folder} className="nav-group admin-folder" onClick={event=>{if(event.target instanceof Element&&event.target.closest('a'))close();}}>
  <summary className={'admin-folder-trigger'+(current?' is-current':'')}><FolderLock size={18} aria-hidden="true"/><span>Administration</span><ChevronRight size={16} className="folder-chevron" aria-hidden="true"/></summary>
  <div className="admin-folder-links"><div className="admin-folder-heading"><span>Administration</span><button type="button" aria-label="Close Administration" onClick={()=>close(true)}><X size={18} aria-hidden="true"/></button></div>{children}</div>
 </details>;
}
