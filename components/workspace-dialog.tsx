'use client';
import {useId,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';

export function WorkspaceDialog({title,children,onClose,busy=false,wide=false,label}:{title:ReactNode;children:ReactNode;onClose:()=>void;busy?:boolean;wide?:boolean;label:string}){
 const titleId=useId();
 if(typeof document==='undefined')return null;
 return createPortal(<div className="app dialog-root"><div className="modal-backdrop" onClick={()=>{if(!busy)onClose();}}><section className={`modal${wide?' wide':''}`} role="dialog" aria-modal="true" aria-label={label} aria-labelledby={titleId} tabIndex={-1} onClick={event=>event.stopPropagation()}><div className="modal-heading"><h2 id={titleId}>{title}</h2><button className="icon-button" disabled={busy} onClick={onClose} aria-label={`Close ${label}`}><X size={22}/></button></div><div className="modal-content">{children}</div></section></div></div>,document.body);
}
