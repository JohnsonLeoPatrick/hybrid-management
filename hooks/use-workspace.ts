'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Database, Role } from '@/types';
import { emptyDatabase } from '@/lib/workspace';
import { supabase } from '@/lib/supabase';
import { usePathname } from 'next/navigation';
import { sectionForPath } from '@/lib/section-routes';
import { loadDatabase, workspaceTables } from '@/services/database';
import { loadWorkspace } from '@/services/workspace';

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
  const active = useRef(false);
  const sequence = useRef(0);

  const clear = useCallback(() => {
    loaded.current=new Set();
    setLoadedKeys(new Set());
    setSectionError('');
    pending.current=null;
    setUser(null);
    setRole('STAFF');
    setDb(emptyDatabase());
    setPaymentUnlocked(false);
    setStaffUnlocked(false);
  }, []);

  const refresh = useCallback(async (showLoading = true) => {
    const request = ++sequence.current;
    if (showLoading) setReady(false);
    setError('');
    try {
      const requestedSection=sectionRef.current;
      const workspace = await loadWorkspace(supabase,()=>loadDatabase(requestedSection));
      if (!active.current || request !== sequence.current) return;
      if (workspace) {
        const [access,staffAccess] = await Promise.all([supabase!.rpc('payment_access'),supabase!.rpc('staff_access')]);
        if (!active.current || request !== sequence.current) return;
        const unlocked = !access.error && access.data === true;
        const staffAllowed = !staffAccess.error && staffAccess.data === true;
        setPaymentUnlocked(unlocked);
        setStaffUnlocked(staffAllowed);
        setDb({...workspace.db,payments:unlocked?workspace.db.payments:[],staff:staffAllowed?workspace.db.staff:workspace.db.staff.filter(person=>person.id===workspace.userId)});
        loaded.current=workspaceTables(requestedSection);
        setLoadedKeys(new Set(loaded.current));
        setSectionError('');
        setUser(workspace.userId);
        setRole(workspace.role);
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
    const { data } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') {
        ++sequence.current;
        clear();
        setError('');
        setReady(true);
      } else if (['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(event)) {
        // Leave the SDK's auth callback before calling its async methods.
        setTimeout(() => { if (active.current) void refresh(event === 'SIGNED_IN'); }, 0);
      }
    });
    // A restored back/forward-cache document must not resurrect an old in-memory login.
    const onRestore = (event: PageTransitionEvent) => { if (event.persisted) window.location.reload(); };
    window.addEventListener('pageshow', onRestore);
    void refresh();
    return () => { active.current = false; ++sequence.current; data.subscription.unsubscribe(); window.removeEventListener('pageshow', onRestore); };
  }, [clear, refresh]);

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
      const [access,staffAccess] = await Promise.all([supabase!.rpc('payment_access'),supabase!.rpc('staff_access')]);
      if (cancelled) return;
      if (access.error || access.data !== true) {
        setPaymentUnlocked(false);
        setDb(current => current.payments.length ? {...current, payments: []} : current);
      }
      if (staffAccess.error || staffAccess.data !== true) {
        setStaffUnlocked(false);
        setDb(current => current.staff.some(person=>person.id!==user) ? {...current,staff:current.staff.filter(person=>person.id===user)} : current);
      }
    };
    const timer = setInterval(() => void check(), 10000);
    window.addEventListener('focus', check);
    return () => { cancelled = true; clearInterval(timer); window.removeEventListener('focus', check); };
  }, [user]);

  return { db, setDb, user, role, ready, error, refresh, paymentUnlocked, staffUnlocked, ensureDetails, sectionError, pageReady:[...workspaceTables(section)].every(key=>loadedKeys.has(key)) };
}
