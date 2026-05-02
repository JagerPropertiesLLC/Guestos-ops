// app/api/admin/users/route.js
// Privileged admin view of app_users with property/entity grant counts.
// Gated by assertSuperAdmin().

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { assertSuperAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const TYPE_ORDER = { super_admin: 0, owner: 1, manager: 2, staff: 3 };

export async function GET(req) {
  const callerId = await assertSuperAdmin(req);
  if (!callerId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const supa = getSupabaseAdmin();
  const { searchParams } = new URL(req.url);
  const includeInactive = searchParams.get('include_inactive') === '1';

  let q = supa
    .from('app_users')
    .select('id, email, full_name, phone, user_type, has_portal_access, active, created_at, notes');
  if (!includeInactive) q = q.eq('active', true);

  const { data: users, error: usersErr } = await q;
  if (usersErr) {
    return NextResponse.json({ error: usersErr.message }, { status: 500 });
  }
  if (!users.length) {
    return NextResponse.json({ users: [] });
  }

  const userIds = users.map(u => u.id);
  const { data: grants, error: grantsErr } = await supa
    .from('user_access_grants')
    .select('user_id, property_id, entity_id')
    .in('user_id', userIds);
  if (grantsErr) {
    return NextResponse.json({ error: grantsErr.message }, { status: 500 });
  }

  const propsByUser = new Map();
  const entitiesByUser = new Map();
  for (const r of grants || []) {
    if (r.property_id) {
      const s = propsByUser.get(r.user_id) || new Set();
      s.add(r.property_id);
      propsByUser.set(r.user_id, s);
    } else if (r.entity_id) {
      const s = entitiesByUser.get(r.user_id) || new Set();
      s.add(r.entity_id);
      entitiesByUser.set(r.user_id, s);
    }
  }

  const enriched = users.map(u => {
    const isSuper = u.user_type === 'super_admin';
    return {
      ...u,
      // Super-admins see everything via is_super_admin() short-circuit; show 'all'.
      property_grant_count: isSuper ? null : (propsByUser.get(u.id)?.size || 0),
      entity_grant_count:   isSuper ? null : (entitiesByUser.get(u.id)?.size || 0),
    };
  });

  enriched.sort((a, b) => {
    const ao = TYPE_ORDER[a.user_type] ?? 99;
    const bo = TYPE_ORDER[b.user_type] ?? 99;
    if (ao !== bo) return ao - bo;
    return (a.full_name || '').localeCompare(b.full_name || '');
  });

  return NextResponse.json({ users: enriched });
}
