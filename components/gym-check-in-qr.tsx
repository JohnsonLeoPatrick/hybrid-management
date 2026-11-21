'use client';

import {useEffect,useState} from 'react';
import QRCode from 'qrcode';
import {Download,ExternalLink,QrCode} from 'lucide-react';
import type {Database} from '@/types';
import {CHECK_IN_ORIGIN,gymCheckInLink} from '@/lib/gym-check-in';
import {getGymCheckInQr} from '@/services/gym-check-in';

export function GymCheckInQr({branches,branch}:{branches:Database['branches'];branch:string}) {
 const activeBranches=branches.filter(item=>item.active);
 const [chosen,setChosen]=useState('');
 const selected=activeBranches.find(item=>item.id===(branch==='all'?chosen:branch))||(branch==='all'?activeBranches[0]:undefined);
 const [qr,setQr]=useState<{branchId:string;image:string;link:string}|null>(null);
 const [error,setError]=useState('');
 const [retry,setRetry]=useState(0);
 const selectedId=selected?.id;
 useEffect(()=>{
  let active=true;
  setQr(null);setError('');
  if(!selectedId)return()=>{active=false;};
  getGymCheckInQr(selectedId).then(async token=>{
   const link=gymCheckInLink(CHECK_IN_ORIGIN,token);
   const image=await QRCode.toDataURL(link,{width:600,margin:4,errorCorrectionLevel:'M',color:{dark:'#000000',light:'#ffffff'}});
   if(active)setQr({branchId:selectedId,image,link});
  }).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'Could not generate check-in QR.');});
  return()=>{active=false;};
 },[selectedId,retry]);
 const current=qr?.branchId===selectedId?qr:null;
 return <section className="panel qr-intro gym-check-in-qr" aria-labelledby="gym-qr-title">
  <div>
   <div className="eyebrow">EXISTING MEMBERS</div>
   <h2 id="gym-qr-title">Gym check-in QR</h2>
   <p>Display this code at reception. Members scan, enter their full name or member ID, and tap Check in.</p>
   {branch==='all'&&!!activeBranches.length&&<label className="field">Check-in branch<select value={selectedId||''} onChange={event=>setChosen(event.target.value)}>{activeBranches.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
   {selected&&<p className="hint">Records gym visits for <b>{selected.name}</b>. Check-ins appear in Overview and saved check-in history.</p>}
   {current&&<a className="text-button" href={current.link} target="_blank" rel="noopener noreferrer">Preview check-in page <ExternalLink size={15} aria-hidden="true"/></a>}
   {!selected&&<p className="hint">Choose an active branch to show its QR.</p>}
   {error&&<><p role="alert" className="error">{error}</p><button className="secondary" onClick={()=>setRetry(value=>value+1)}>Try again</button></>}
  </div>
  <div className="qr-display" aria-busy={!!selected&&!current&&!error}>
   {current?<><img src={current.image} alt={`Scan to check in at ${selected?.name}`} width={230} height={230}/><b>GYM CHECK-IN</b><small>{selected?.name}</small><a className="primary" href={current.image} download={`hybrid-${selected?.code.toLowerCase()}-check-in-qr.png`}><Download size={16} aria-hidden="true"/>Download QR</a></>:<><QrCode size={80} aria-hidden="true"/><p role="status">{!selected?'No active branch':error?'QR unavailable':'Preparing QR…'}</p></>}
  </div>
 </section>;
}
