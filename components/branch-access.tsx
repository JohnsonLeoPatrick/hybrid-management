'use client';
import {useState} from 'react';
import {Building2, LockKeyhole} from 'lucide-react';
import type {Branch} from '@/types';
import {supabase} from '@/lib/supabase';

export function BranchAccess({branches,initialBranch,refresh}:{branches:Branch[];initialBranch:string;refresh:()=>Promise<void>}) {
 const [branch,setBranch]=useState(initialBranch||branches.find(item=>item.active)?.id||'');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 return <div className="login"><section className="login-card">
  <Building2 size={30} aria-hidden="true"/>
  <h1>Enter a branch</h1><p>Choose your branch and enter its password to open the workspace.</p>
  <form onSubmit={async event=>{
   event.preventDefault();setBusy(true);setError('');
   const form=event.currentTarget,password=String(new FormData(form).get('branchPassword')||'');form.reset();
   try{
    if(!supabase)throw new Error('Database unavailable.');
    const result=await supabase.rpc('unlock_branch',{branch_id:branch,branch_password:password});
    if(result.error)throw new Error('Branch access is unavailable. Please try again.');
    if(result.data!==true)throw new Error('Incorrect branch password or branch unavailable. After five failed attempts, wait 15 minutes.');
    await refresh();
   }catch(cause){setError(cause instanceof Error?cause.message:'Could not open branch.');}finally{setBusy(false);}
  }}>
   <label className="field">Branch<select value={branch} onChange={event=>{setBranch(event.target.value);setError('');}} disabled={busy} required>
    <option value="" disabled>Choose a branch</option>{branches.filter(item=>item.active).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
   </select></label>
   <label className="field">Branch password<input name="branchPassword" type="password" autoComplete="off" required disabled={busy} maxLength={72}/></label>
   {error&&<p role="alert" className="error">{error}</p>}
   <button className="primary" disabled={busy||!branch}><LockKeyhole size={16}/>{busy?'Opening branch...':'Enter branch'}</button>
  </form>
  <button type="button" className="text-button" disabled={busy} onClick={async()=>{const result=await supabase?.auth.signOut();if(result?.error)setError(result.error.message);}}>Sign out</button>
 </section></div>;
}
