import type { SupabaseClient } from '@supabase/supabase-js';
import { loadDatabase } from './database';

export async function loadWorkspace(client: SupabaseClient | null, readDatabase = loadDatabase) {
  if (!client) throw new Error('Supabase is not configured. Ask your administrator to finish the connection setup.');
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session) return null;

  // Verify the remembered login with Auth before loading any workspace records.
  const { data: identity, error: identityError } = await client.auth.getUser();
  if (identityError) throw identityError;
  if (!identity.user) throw new Error('Your session could not be verified. Please sign in again.');

  const db = await readDatabase();
  const staff = db.staff.find(person => person.id === identity.user!.id);
  if (!staff) throw new Error('Your account has no staff access. Ask an administrator to grant access.');
  return { db, userId: identity.user.id, role: staff.role };
}
