// lib/supabaseServer.js
// Server-side Supabase client using the new sb_secret_ key.
// IMPORTANT: never import this from a client component.

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Service role key for server-side ops (bypasses RLS, which is currently disabled anyway).
// On Vercel set this as SUPABASE_SERVICE_ROLE_KEY = sb_secret_...
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.warn('[supabaseServer] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

let _client = null;
export function getSupabaseAdmin() {
  if (_client) return _client;
  _client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return _client;
}
