import type { SupabaseClient } from '@supabase/supabase-js';
import { loadDatabase } from './database';
import { workspaceSession } from '../lib/auth-session';

export async function signInWithUsername(client: SupabaseClient, username: string, password: string) {
  const response = await fetch('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }), cache: 'no-store',
  });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Sign-in failed. Please try again.');
  if (typeof data.access_token !== 'string' || typeof data.refresh_token !== 'string') throw new Error('Sign-in failed. Please try again.');
  const { error } = await client.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
  if (error) throw error;
}

export async function loadWorkspace(client: SupabaseClient | null, readDatabase: () => Promise<import('@/types').Database> = loadDatabase) {
  if (!client) throw new Error('Supabase is not configured. Ask your administrator to finish the connection setup.');
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session) return null;

  // Verify the remembered login with Auth before loading any workspace records.
  const { data: identity, error: identityError } = await client.auth.getUser();
  if (identityError) throw identityError;
  if (!identity.user) throw new Error('Your session could not be verified. Please sign in again.');

  const session = workspaceSession(sessionData.session.access_token);
  if (!session || Date.now() >= session.expiresAt) {
    await client.auth.signOut({ scope: 'local' });
    return null;
  }

  const db = await readDatabase();
  const staff = db.staff.find(person => person.id === identity.user!.id);
  if (!staff) throw new Error('Your account has no staff access. Ask an administrator to grant access.');
  return { db, userId: identity.user.id, role: staff.role, session };
}
