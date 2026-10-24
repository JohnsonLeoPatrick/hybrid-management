import { createClient } from '@supabase/supabase-js';
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Keep credentials only in this document's memory. New tabs and full reloads require a fresh login.
export const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && publicKey ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, publicKey, {
 auth: { persistSession: false, detectSessionInUrl: false },
}) : null;
