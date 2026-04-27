// lib/supabaseClient.js
// Browser-side Supabase client using the publishable key.
// Safe to import from client components.

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let _client = null;
export function getSupabaseBrowser() {
  if (_client) return _client;
  _client = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true }
  });
  return _client;
}
