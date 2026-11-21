import { createClient } from '@supabase/supabase-js';
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Restore login across reloads and tabs; useWorkspace enforces the 24-hour sign-in limit.
export const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && publicKey ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, publicKey, {
 auth: { persistSession: true, detectSessionInUrl: false },
}) : null;
