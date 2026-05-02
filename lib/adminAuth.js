// lib/adminAuth.js
// Server-side super-admin gate for /api/admin/* routes.
// Mirrors the hardcode pattern in lib/permissions.js until Supabase Auth is wired.
//
// Usage:
//   import { assertSuperAdmin } from '@/lib/adminAuth';
//   const callerId = await assertSuperAdmin(req);
//   if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
//
// TODO(auth): when app_users.auth_user_id is populated and Supabase Auth is live,
// replace internals with: read JWT -> call public.is_super_admin() RPC -> return
// app_users.id if true. Public API (assertSuperAdmin) stays the same.

import { getSupabaseAdmin } from './supabaseServer';

const HARDCODED_SUPER_ADMIN_EMAIL = 'judson@duracoproperties.com';

export async function assertSuperAdmin(/* req */) {
  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from('app_users')
    .select('id, email, user_type, active')
    .eq('email', HARDCODED_SUPER_ADMIN_EMAIL)
    .eq('active', true)
    .maybeSingle();

  if (error) {
    console.error('[adminAuth] lookup failed:', error.message);
    return null;
  }
  if (!data || data.user_type !== 'super_admin') {
    console.error('[adminAuth] resolved row is not an active super_admin:', data);
    return null;
  }
  return data.id;
}
