'use client';

import {useEffect,useRef,useState} from 'react';
import {ArrowRight,CheckCircle2} from 'lucide-react';
import {gymCheckInOptions,submitGymCheckIn} from '@/services/gym-check-in';

export default function PublicGymCheckIn({token}:{token:string}) {
 const [branch,setBranch]=useState('');
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [result,setResult]=useState<{status:'checked_in'|'already_checked_in';date:string}|null>(null);
 const lock=useRef(false);
 const heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{
  let active=true;
  setBranch('');setLoading(true);setError('');setResult(null);
  gymCheckInOptions(token).then(data=>{if(active)setBranch(data.branchName);})
   .catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'Check-in is unavailable.');})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[token]);
 useEffect(()=>{if(result)heading.current?.focus();},[result]);
 return <main className="public-registration public-gym-check-in"><div className="join-shell">
  <div className="brand"><img className="academy-logo" src="/hybrid-logo.png" alt="" width={52} height={56}/><span>HYBRID<small>COMBATIVE ACADEMY &amp; GYM</small></span></div>
  <section className={'panel join-card'+(result?' join-success':'')} aria-busy={loading||busy}>
   {loading?<p role="status">Getting check-in ready…</p>:result?<>
    <CheckCircle2 size={58} aria-hidden="true"/>
    <h1 ref={heading} tabIndex={-1}>{result.status==='already_checked_in'?'Already checked in.':'You’re checked in.'}</h1>
    <p>{result.status==='already_checked_in'?'Your gym visit is already recorded for today.':'Your gym visit has been recorded. Enjoy your training.'}</p>
    <div className="renewal-preview">{branch} · <time dateTime={result.date}>{new Intl.DateTimeFormat('en-MY',{dateStyle:'long',timeZone:'Asia/Kuala_Lumpur'}).format(new Date(result.date+'T12:00:00+08:00'))}</time></div>
    <button className="secondary full" onClick={()=>{setResult(null);setError('');}}>Check in another member</button>
   </>:<>
    <div className="eyebrow">{branch||'HYBRID ACADEMY'} · GYM VISIT</div>
    <h1>Gym check-in</h1>
    <p>Enter your full name or member ID to check in.</p>
    {branch&&<form onSubmit={async event=>{
     event.preventDefault();
     if(lock.current)return;
     const identifier=String(new FormData(event.currentTarget).get('identifier')||'');
     lock.current=true;setBusy(true);setError('');
     try{setResult(await submitGymCheckIn(token,identifier));}
     catch(cause){setError(cause instanceof Error?cause.message:'Could not check in. Please try again.');}
     finally{lock.current=false;setBusy(false);}
    }}>
     <label className="field" htmlFor="gym-member-identifier">Full name or member ID
      <input id="gym-member-identifier" name="identifier" placeholder="e.g. Jane Doe or 01" required maxLength={120} autoComplete="off" disabled={busy} aria-describedby="gym-check-in-hint"/>
     </label>
     <p className="hint" id="gym-check-in-hint">Use the full name on your membership. If someone shares your name, use your member ID.</p>
     {error&&<p className="error" role="alert">{error}</p>}
     <button className="primary full" disabled={busy}>{busy?'Checking in…':'Check in'}<ArrowRight size={17} aria-hidden="true"/></button>
    </form>}
    {!branch&&error&&<><p className="error" role="alert">{error}</p><button className="secondary" onClick={()=>window.location.reload()}>Try again</button></>}
   </>}
  </section>
  <p className="join-footer">Hybrid Combative Academy &amp; Gym</p>
 </div></main>;
}
