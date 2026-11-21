import { createClient } from '@supabase/supabase-js';

const reply = (body: object, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: Request) {
 let credentials: unknown;
 try {
  const body = await request.text();
  if (body.length > 4096) return reply({ error: 'Invalid sign-in request.' }, 400);
  credentials = JSON.parse(body);
 } catch {
  return reply({ error: 'Invalid sign-in request.' }, 400);
 }
 const { username, password } = (credentials && typeof credentials === 'object' ? credentials : {}) as Record<string, unknown>;
 if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || username.length > 254 || !password || password.length > 1024) {
  return reply({ error: 'Enter your username and password.' }, 400);
 }
 const identity = username.trim().toLowerCase();
 const email = identity === 'admin' ? process.env.ADMIN_LOGIN_EMAIL : identity.includes('@') ? identity : '';
 if (!email) return reply({ error: 'Invalid username or password.' }, 401);
 const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if (!url || !key) return reply({ error: 'Sign-in is unavailable. Please try again later.' }, 503);
 try {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
   const status = error?.status === 429 ? 429 : error?.status && error.status >= 500 ? 503 : 401;
   return reply({ error: status === 429 ? 'Too many sign-in attempts. Please try again later.' : status === 503 ? 'Sign-in is unavailable. Please try again later.' : 'Invalid username or password.' }, status);
  }
  return reply({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
 } catch {
  return reply({ error: 'Sign-in is unavailable. Please try again later.' }, 503);
 }
}
