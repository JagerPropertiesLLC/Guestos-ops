// lib/orgContext.js
// Singleton-org helper. Multi-tenant scaffolding is in place but only one
// organizations row exists today — every server-side write that needs org_id
// reads it from here. When a second org onboards, replace this with a real
// per-caller resolver. Tracked in project_pending_schema_cleanups.md.

import { getSupabaseAdmin } from './supabaseServer';

let _cached = null;

export async function getSingletonOrgId() {
  if (_cached) return _cached;
  const supa = getSupabaseAdmin();
  const { data } = await supa.from('organizations').select('id').limit(1).maybeSingle();
  _cached = data?.id || null;
  return _cached;
}

const HARDCODED_CALLER_EMAIL = 'judson@duracoproperties.com';

// Returns the app_users.id of the current caller, or null. Mirrors the pattern
// in lib/permissions.js + lib/adminAuth.js. Use this to stamp uploaded_by /
// captured_by / created_by columns from API routes.
export async function currentCallerId() {
  const supa = getSupabaseAdmin();
  const { data } = await supa
    .from('app_users')
    .select('id')
    .eq('email', HARDCODED_CALLER_EMAIL)
    .eq('active', true)
    .maybeSingle();
  return data?.id || null;
}
