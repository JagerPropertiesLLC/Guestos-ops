// app/api/admin/users/[id]/route.js
// User detail (GET) and field updates (PATCH).
// Both gated by assertSuperAdmin().

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { assertSuperAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

const ALLOWED_USER_TYPES = ['super_admin', 'owner', 'admin', 'manager', 'ops', 'staff', 'viewer'];

export async function GET(req, { params }) {
  const callerId = await assertSuperAdmin(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { id } = params;
  const supa = getSupabaseAdmin();

  const { data: user, error: userErr } = await supa
    .from('app_users')
    .select('id, email, full_name, phone, user_type, has_portal_access, active, notes, created_at')
    .eq('id', id)
    .maybeSingle();
  if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 });
  if (!user)   return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data: grants, error: grantsErr } = await supa
    .from('user_access_grants')
    .select(`
      id, module, role, property_id, entity_id, created_at,
      property:properties!property_id ( short_name, full_address ),
      entity:entities!entity_id ( name, slug ),
      overrides:user_capabilities ( id, capability_id, enabled, capability:capabilities!capability_id ( slug, label ) )
    `)
    .eq('user_id', id)
    .order('created_at', { ascending: true });
  if (grantsErr) return NextResponse.json({ error: grantsErr.message }, { status: 500 });

  const { count: superCount, error: superErr } = await supa
    .from('app_users')
    .select('id', { count: 'exact', head: true })
    .eq('user_type', 'super_admin')
    .eq('active', true);
  if (superErr) return NextResponse.json({ error: superErr.message }, { status: 500 });

  const isLastSuperAdmin =
    user.user_type === 'super_admin' && user.active && superCount === 1;

  return NextResponse.json({
    user,
    grants: (grants || []).map(g => ({
      id: g.id,
      module: g.module,
      role: g.role,
      property_id: g.property_id,
      property_name:    g.property?.short_name   || null,
      property_address: g.property?.full_address || null,
      entity_id: g.entity_id,
      entity_name: g.entity?.name || null,
      created_at: g.created_at,
      overrides: (g.overrides || []).map(o => ({
        id: o.id,
        capability_id:    o.capability_id,
        capability_slug:  o.capability?.slug,
        capability_label: o.capability?.label,
        enabled: o.enabled,
      })),
    })),
    is_self: callerId === id,
    is_last_super_admin: isLastSuperAdmin,
  });
}

export async function PATCH(req, { params }) {
  const callerId = await assertSuperAdmin(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { id } = params;
  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const allowed = ['user_type', 'has_portal_access', 'active', 'notes', 'phone'];
  const update = {};
  for (const k of allowed) if (k in body) update[k] = body[k];
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'no_valid_fields' }, { status: 400 });
  }
  if ('user_type' in update && !ALLOWED_USER_TYPES.includes(update.user_type)) {
    return NextResponse.json({ error: 'invalid_user_type' }, { status: 400 });
  }

  const supa = getSupabaseAdmin();

  const { data: target, error: targetErr } = await supa
    .from('app_users')
    .select('id, user_type, active')
    .eq('id', id)
    .maybeSingle();
  if (targetErr) return NextResponse.json({ error: targetErr.message }, { status: 500 });
  if (!target)   return NextResponse.json({ error: 'not_found' }, { status: 404 });

  if (callerId === id) {
    if ('user_type' in update || 'active' in update) {
      return NextResponse.json(
        { error: 'self_edit_blocked', message: 'You cannot change your own user type or active status.' },
        { status: 400 }
      );
    }
  }

  const wouldDemote     = 'user_type' in update && update.user_type !== 'super_admin' && target.user_type === 'super_admin';
  const wouldDeactivate = 'active' in update && update.active === false && target.active && target.user_type === 'super_admin';
  if (wouldDemote || wouldDeactivate) {
    const { count, error: cntErr } = await supa
      .from('app_users')
      .select('id', { count: 'exact', head: true })
      .eq('user_type', 'super_admin')
      .eq('active', true);
    if (cntErr) return NextResponse.json({ error: cntErr.message }, { status: 500 });
    if (count === 1) {
      return NextResponse.json(
        { error: 'last_super_admin', message: 'Cannot demote or deactivate the last active super admin.' },
        { status: 409 }
      );
    }
  }

  const { data: updated, error: updErr } = await supa
    .from('app_users')
    .update(update)
    .eq('id', id)
    .select('id, email, full_name, phone, user_type, has_portal_access, active, notes, created_at')
    .single();
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ user: updated });
}
