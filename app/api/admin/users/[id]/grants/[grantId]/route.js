// app/api/admin/users/[id]/grants/[grantId]/route.js
// PATCH grant role. DELETE grant (cascades user_capabilities).

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { assertSuperAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const ALLOWED_ROLES = ['owner', 'manager', 'ops', 'viewer'];

async function loadGrant(supa, userId, grantId) {
  const { data, error } = await supa
    .from('user_access_grants')
    .select('id, user_id, role')
    .eq('id', grantId)
    .maybeSingle();
  if (error) return { error };
  if (!data) return { notFound: true };
  if (data.user_id !== userId) return { mismatch: true };
  return { grant: data };
}

export async function PATCH(req, { params }) {
  const callerId = await assertSuperAdmin(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { id: userId, grantId } = params;
  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  if (!ALLOWED_ROLES.includes(body.role)) {
    return NextResponse.json({ error: 'invalid_role' }, { status: 400 });
  }

  const supa = getSupabaseAdmin();
  const { error: loadErr, notFound, mismatch } = await loadGrant(supa, userId, grantId);
  if (loadErr)  return NextResponse.json({ error: loadErr.message }, { status: 500 });
  if (notFound) return NextResponse.json({ error: 'grant_not_found' }, { status: 404 });
  if (mismatch) return NextResponse.json({ error: 'grant_user_mismatch' }, { status: 404 });

  const { data: updated, error } = await supa
    .from('user_access_grants')
    .update({ role: body.role })
    .eq('id', grantId)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ grant: updated });
}

export async function DELETE(req, { params }) {
  const callerId = await assertSuperAdmin(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { id: userId, grantId } = params;
  const supa = getSupabaseAdmin();
  const { error: loadErr, notFound, mismatch } = await loadGrant(supa, userId, grantId);
  if (loadErr)  return NextResponse.json({ error: loadErr.message }, { status: 500 });
  if (notFound) return NextResponse.json({ error: 'grant_not_found' }, { status: 404 });
  if (mismatch) return NextResponse.json({ error: 'grant_user_mismatch' }, { status: 404 });

  // No FK CASCADE on user_capabilities — manual cascade
  const { error: capErr } = await supa.from('user_capabilities').delete().eq('grant_id', grantId);
  if (capErr) return NextResponse.json({ error: capErr.message }, { status: 500 });

  const { error: delErr } = await supa.from('user_access_grants').delete().eq('id', grantId);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
