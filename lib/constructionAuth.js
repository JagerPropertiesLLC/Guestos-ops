// lib/constructionAuth.js
// Server-side gate for /api/construction/* routes.
// Allows: super-admin OR any user with at least one user_access_grants row
// scoped to module='construction'.
//
// Hardcoded to judson@duracoproperties.com until Supabase Auth is wired,
// matching the lib/adminAuth.js pattern.
//
// TODO(auth): when JWT auth lands, derive caller email from session and
// replace HARDCODED_CALLER_EMAIL. Public API (assertConstructionAccess) stays
// the same.

import { getSupabaseAdmin } from './supabaseServer';

const HARDCODED_CALLER_EMAIL = 'judson@duracoproperties.com';

export async function assertConstructionAccess(/* req */) {
  const supa = getSupabaseAdmin();

  const { data: user, error } = await supa
    .from('app_users')
    .select('id, user_type, active')
    .eq('email', HARDCODED_CALLER_EMAIL)
    .eq('active', true)
    .maybeSingle();

  if (error) {
    console.error('[constructionAuth] lookup failed:', error.message);
    return null;
  }
  if (!user) return null;
  if (user.user_type === 'super_admin') return user.id;

  const { data: grant } = await supa
    .from('user_access_grants')
    .select('id')
    .eq('user_id', user.id)
    .eq('module', 'construction')
    .limit(1)
    .maybeSingle();

  return grant ? user.id : null;
}
