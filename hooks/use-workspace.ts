'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Database, Role } from '@/types';
import { emptyDatabase } from '@/lib/workspace';
import { supabase } from '@/lib/supabase';
import { usePathname } from 'next/navigation';
import { sectionForPath } from '@/lib/section-routes';
import { loadDatabase, workspaceTables } from '@/services/database';
import { loadWorkspace } from '@/services/workspace';
import { workspaceSession } from '@/lib/auth-session';

export function useWorkspace() {
  const section=sectionForPath(usePathname());
  const sectionRef=useRef(section);
  sectionRef.current=section;
  const loaded=useRef(new Set<keyof Database>());
  const [loadedKeys,setLoadedKeys]=useState(new Set<keyof Database>());
  const [sectionError,setSectionError]=useState('');
  const pending=useRef<Promise<void>|null>(null);
  const [db, setDb] = useState(emptyDatabase);
  const [user, setUser] = useState<string | null>(null);
  const [role, setRole] = useState<Role>('STAFF');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [paymentUnlocked, setPaymentUnlocked] = useState(false);
  const [staffUnlocked, setStaffUnlocked] = useState(false);
  const [currentBranch,setCurrentBranch]=useState<string|null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const identity = useRef<{ userId: string; sessionId: string } | null>(null);
  const active = useRef(false);
  const sequence = useRef(0);

  const clear = useCallback(() => {
    identity.current=null;
    setExpiresAt(null);
    loaded.current=new Set();
    setLoadedKeys(new Set());
    setSectionError('');
    pending.current=null;
    setUser(null);
    setRole('STAFF');
    setDb(emptyDatabase());
    setPaymentUnlocked(false);
    setStaffUnlocked(false);
    setCurrentBranch(null);
  }, []);

  const refresh = useCallback(async (showLoading = true) => {
    const request = ++sequence.current;
    if (showLoading) setReady(false);
    setError('');
    try {
      const requestedSection=sectionRef.current;
      let beforeBranch:string|null=null;
      const workspace = await loadWorkspace(supabase,async()=>{
        const access=await supabase!.rpc('current_branch');
        if(access.error)throw new Error('Branch access is unavailable. Please try again later.');
        beforeBranch=typeof access.data==='string'?access.data:null;
        return loadDatabase(requestedSection);
      });
      if (!active.current || request !== sequence.current) return;
      if (workspace) {
        const [access,staffAccess,branchAccess] = await Promise.all([supabase!.rpc('payment_access'),supabase!.rpc('staff_access'),supabase!.rpc('current_branch')]);
        if (!active.current || request !== sequence.current) return;
        if(branchAccess.error)throw new Error('Branch access is unavailable. Please try again later.');
        if(beforeBranch!==branchAccess.data)throw new Error('The branch changed while loading. Please try again.');
        setCurrentBranch(typeof branchAccess.data==='string'?branchAccess.data:null);
        const unlocked = !access.error && access.data === true;
        const staffAllowed = !staffAccess.error && staffAccess.data === true;
        setPaymentUnlocked(unlocked);
        setStaffUnlocked(staffAllowed);
        setDb({...branchAccess.data?workspace.db:{...emptyDatabase(),branches:workspace.db.branches,staff:workspace.db.staff},payments:unlocked&&branchAccess.data?workspace.db.payments:[],staff:staffAllowed?workspace.db.staff:workspace.db.staff.filter(person=>person.id===workspace.userId)});
        loaded.current=workspaceTables(requestedSection);
        setLoadedKeys(new Set(loaded.current));
        setSectionError('');
        setUser(workspace.userId);
        setRole(workspace.role);
        identity.current={userId:workspace.userId,sessionId:workspace.session.id};
        setExpiresAt(workspace.session.expiresAt);
      } else clear();
    } catch (cause) {
      if (!active.current || request !== sequence.current) return;
      clear();
      setError(cause instanceof Error ? cause.message : 'Could not load the live workspace. Please retry.');
    } finally {
      if (active.current && request === sequence.current) setReady(true);
    }
  }, [clear]);

  useEffect(() => {
    active.current = true;
    if (!supabase) { setReady(true); return () => { active.current = false; }; }
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        ++sequence.current;
        clear();
        setError('');
        setReady(true);
      } else if (['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(event)) {
        const incoming=session&&workspaceSession(session.access_token);
        if (incoming && incoming.id===identity.current?.sessionId) return;
        const sameUser=!!session&&session.user.id===identity.current?.userId;
        if (!sameUser) { ++sequence.current; clear(); }
        if (incoming && session) identity.current={userId:session.user.id,sessionId:incoming.id};
        // Leave the SDK's auth callback before calling its async methods.
        setTimeout(() => { if (active.current) void refresh(!sameUser); }, 0);
      }
    });
    // Revalidate restored pages without replacing the workspace with a loading screen.
    const onRestore=(event:PageTransitionEvent)=>{if(event.persisted)void refresh(false);};
    window.addEventListener('pageshow',onRestore);
    void refresh();
    return () => { active.current = false; ++sequence.current; data.subscription.unsubscribe(); window.removeEventListener('pageshow',onRestore); };
  }, [clear, refresh]);

  useEffect(() => {
    if (!expiresAt || !supabase) return;
    const expire = () => {
      if (Date.now()<expiresAt) return;
      ++sequence.current;
      clear();
      setReady(true);
      void supabase!.auth.signOut({scope:'local'});
    };
    const timer=setTimeout(expire,Math.max(0,expiresAt-Date.now()));
    window.addEventListener('focus',expire);
    window.addEventListener('pageshow',expire);
    document.addEventListener('visibilitychange',expire);
    return()=>{clearTimeout(timer);window.removeEventListener('focus',expire);window.removeEventListener('pageshow',expire);document.removeEventListener('visibilitychange',expire);};
  }, [expiresAt,clear]);

  const ensureTables = useCallback(async (required:Set<keyof Database>):Promise<void> => {
    if(pending.current){await pending.current;return ensureTables(required);}
    const missing=new Set([...required].filter(key=>!loaded.current.has(key)));
    if(!missing.size)return;
    const generation=sequence.current;
    const work=(async()=>{
      const rows=await loadDatabase(sectionRef.current,false,missing);
      if(!active.current||generation!==sequence.current)return;
      setDb(current=>{
        const next={...current};
        for(const key of missing)Object.assign(next,{[key]:rows[key]});
        return next;
      });
      missing.forEach(key=>loaded.current.add(key));
      setLoadedKeys(new Set(loaded.current));
    })();
    pending.current=work;
    try{await work;}finally{if(pending.current===work)pending.current=null;}
  },[]);
  const ensureDetails=useCallback(()=>ensureTables(workspaceTables(sectionRef.current,true)),[ensureTables]);
  useEffect(()=>{
    if(!user||!ready)return;
    let cancelled=false;
    setSectionError('');
    void ensureTables(workspaceTables(section)).catch(()=>{
      if(!cancelled)setSectionError('Could not load this section. Please retry.');
    });
    return()=>{cancelled=true;};
  },[section,user,ready,ensureTables]);

  useEffect(() => {
    if (!user || !supabase) return;
    let cancelled = false;
    const check = async () => {
      const [access,staffAccess,branchAccess] = await Promise.all([supabase!.rpc('payment_access'),supabase!.rpc('staff_access'),supabase!.rpc('current_branch')]);
      if (cancelled) return;
      const branch=branchAccess.error?null:branchAccess.data;
      if(branch!==currentBranch){
        setCurrentBranch(null);
        setDb(current=>({...emptyDatabase(),branches:current.branches,staff:current.staff.filter(person=>person.id===user)}));
        void refresh(false);
      }
      if (access.error || access.data !== true) {
        setPaymentUnlocked(false);
        setDb(current => current.payments.length ? {...current, payments: []} : current);
      }
      if (staffAccess.error || staffAccess.data !== true) {
        setStaffUnlocked(false);
        setDb(current => current.staff.some(person=>person.id!==user) ? {...current,staff:current.staff.filter(person=>person.id===user)} : current);
      }
    };
    const timer = setInterval(() => void check(), 60000);
    window.addEventListener('focus', check);
    return () => { cancelled = true; clearInterval(timer); window.removeEventListener('focus', check); };
  }, [user,currentBranch,refresh]);

  return { db, setDb, user, role, ready, error, refresh, paymentUnlocked, staffUnlocked, currentBranch, ensureDetails, sectionError, pageReady:[...workspaceTables(section)].every(key=>loadedKeys.has(key)) };
}
