import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { POST } from '../app/api/auth/login/route';
import { signInWithUsername } from '../services/workspace';

test('username login authenticates through Supabase without exposing the account email', async () => {
 const previousFetch = globalThis.fetch;
 const previousEnv = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, email: process.env.ADMIN_LOGIN_EMAIL };
 process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://auth.example.test';
 process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-public-key';
 process.env.ADMIN_LOGIN_EMAIL = 'owner@example.test';
 let calls = 0;
 const invoke = (body: unknown) => POST(new Request('https://management.example.test/api/auth/login', { method: 'POST', body: JSON.stringify(body) }));
 try {
  globalThis.fetch = async (input, options) => {
   calls++;
   assert.equal(String(input), 'https://auth.example.test/auth/v1/token?grant_type=password');
   assert.deepEqual(JSON.parse(String(options?.body)), { email: 'owner@example.test', password: 'trial', gotrue_meta_security: {} });
   return Response.json({ access_token: 'access-token', refresh_token: 'refresh-token', token_type: 'bearer', expires_in: 3600, user: { id: 'staff-id', email: 'owner@example.test', aud: 'authenticated' } });
  };
  const success = await invoke({ username: ' ADMIN ', password: 'trial' });
  assert.equal(success.status, 200);
  assert.equal(success.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await success.json(), { access_token: 'access-token', refresh_token: 'refresh-token' });
  assert.equal(calls, 1);
  assert.equal((await invoke({ username: 'unknown', password: 'trial' })).status, 401);
  assert.equal((await invoke({ username: 'admin', password: '' })).status, 400);
  assert.equal((await invoke({ username: 'admin', password: 123 })).status, 400);
  assert.equal((await invoke(null)).status, 400);
  assert.equal((await invoke({ username: 'admin', password: 'x'.repeat(5000) })).status, 400);
  assert.equal((await POST(new Request('https://management.example.test/api/auth/login', { method: 'POST', body: '{' }))).status, 400);
  assert.equal(calls, 1);
  for (const [upstream, expected] of [[400, 401], [429, 429], [503, 503]]) {
   globalThis.fetch = async () => Response.json({ msg: 'Upstream private detail', error_code: 'invalid_credentials' }, { status: upstream });
   const response = await invoke({ username: 'admin', password: 'wrong' });
   assert.equal(response.status, expected);
   assert.ok(!JSON.stringify(await response.json()).includes('Upstream private detail'));
  }
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  assert.equal((await invoke({ username: 'admin', password: 'trial' })).status, 503);
 } finally {
  globalThis.fetch = previousFetch;
  for (const [key, value] of Object.entries({ NEXT_PUBLIC_SUPABASE_URL: previousEnv.url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: previousEnv.key, ADMIN_LOGIN_EMAIL: previousEnv.email })) {
   if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
 }
});

test('the browser installs only a verified Supabase session and rejects failed sign-in', async () => {
 const previousFetch = globalThis.fetch;
 const sessions: unknown[] = [];
 const client = { auth: { setSession: async (session: unknown) => { sessions.push(session); return { error: null }; } } } as unknown as SupabaseClient;
 try {
  globalThis.fetch = async (input, options) => {
   assert.equal(input, '/api/auth/login');
   assert.deepEqual(JSON.parse(String(options?.body)), { username: 'admin', password: 'trial' });
   return Response.json({ access_token: 'access-token', refresh_token: 'refresh-token' });
  };
  await signInWithUsername(client, 'admin', 'trial');
  assert.deepEqual(sessions, [{ access_token: 'access-token', refresh_token: 'refresh-token' }]);
  globalThis.fetch = async () => Response.json({ error: 'Invalid username or password.' }, { status: 401 });
  await assert.rejects(signInWithUsername(client, 'admin', 'wrong'), /Invalid username or password/);
  globalThis.fetch = async () => Response.json({});
  await assert.rejects(signInWithUsername(client, 'admin', 'trial'), /Sign-in failed/);
  assert.equal(sessions.length, 1);
 } finally { globalThis.fetch = previousFetch; }
});
