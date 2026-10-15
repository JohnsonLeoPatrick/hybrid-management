import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { emptyDatabase } from '../lib/workspace';
import { loadWorkspace } from '../services/workspace';

function authClient({ signedIn = true, valid = true } = {}) {
  return { auth: {
    getSession: async () => ({ data: { session: signedIn ? { user: { id: 'staff-id' } } : null }, error: null }),
    getUser: async () => valid
      ? { data: { user: { id: 'staff-id' } }, error: null }
      : { data: { user: null }, error: new Error('Session expired') },
  } } as unknown as SupabaseClient;
}

test('missing Supabase configuration blocks access instead of opening demo records', async () => {
  let reads = 0;
  await assert.rejects(loadWorkspace(null, async () => { reads++; return emptyDatabase(); }), /not configured/);
  assert.equal(reads, 0);
});

test('signed-out visitors cannot load member records', async () => {
  let reads = 0;
  const result = await loadWorkspace(authClient({ signedIn: false }), async () => { reads++; return emptyDatabase(); });
  assert.equal(result, null);
  assert.equal(reads, 0);
});

test('a forged or expired remembered session cannot load member records', async () => {
  let reads = 0;
  await assert.rejects(loadWorkspace(authClient({ valid: false }), async () => { reads++; return emptyDatabase(); }), /Session expired/);
  assert.equal(reads, 0);
});

test('a real Auth login without staff authorization is rejected', async () => {
  await assert.rejects(loadWorkspace(authClient(), async () => emptyDatabase()), /no staff access/);
});

test('verified staff receive only fetched live records and their assigned role', async () => {
  const live = emptyDatabase();
  live.staff.push({ id: 'staff-id', name: 'Reception', email: 'staff@example.com', role: 'STAFF', branchId: 'dd' });
  const result = await loadWorkspace(authClient(), async () => live);
  assert.equal(result?.db, live);
  assert.equal(result?.userId, 'staff-id');
  assert.equal(result?.role, 'STAFF');
  assert.equal(result?.db.members.length, 0);
});

test('database failures block access rather than falling back to local records', async () => {
  await assert.rejects(loadWorkspace(authClient(), async () => { throw new Error('Database offline'); }), /Database offline/);
});
