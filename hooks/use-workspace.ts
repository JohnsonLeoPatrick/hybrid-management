'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Role } from '@/types';
import { emptyDatabase } from '@/lib/workspace';
import { supabase } from '@/lib/supabase';
import { loadWorkspace } from '@/services/workspace';

export function useWorkspace() {
  const [db, setDb] = useState(emptyDatabase);
  const [user, setUser] = useState<string | null>(null);
  const [role, setRole] = useState<Role>('STAFF');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const active = useRef(false);
  const sequence = useRef(0);

  const clear = useCallback(() => {
    setUser(null);
    setRole('STAFF');
    setDb(emptyDatabase());
  }, []);

  const refresh = useCallback(async (showLoading = true) => {
    const request = ++sequence.current;
    if (showLoading) setReady(false);
    setError('');
    try {
      const workspace = await loadWorkspace(supabase);
      if (!active.current || request !== sequence.current) return;
      if (workspace) {
        setDb(workspace.db);
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
    void refresh();
    return () => { active.current = false; ++sequence.current; data.subscription.unsubscribe(); };
  }, [clear, refresh]);

  return { db, setDb, user, role, ready, error, refresh };
}
