// app/api/admin/users/[id]/grants/[grantId]/capabilities/route.js
// Tri-state capability override per grant.
//   enabled: true  -> upsert row enabled=true
//   enabled: false -> upsert row enabled=false
//   enabled: null  -> delete row (back to inheriting role default)

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { assertSuperAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function PATCH(req, { params }) {
  const callerId = await assertSuperAdmin(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { id: userId, grantId } = params;
  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const { capability_id, enabled } = body || {};
  if (!capability_id) return NextResponse.json({ error: 'capability_id_required' }, { status: 400 });
  if (enabled !== true && enabled !== false && enabled !== null) {
    return NextResponse.json({ error: 'enabled_must_be_true_false_or_null' }, { status: 400 });
  }

  const supa = getSupabaseAdmin();

  const { data: grant } = await supa
    .from('user_access_grants').select('id, user_id').eq('id', grantId).maybeSingle();
  if (!grant) return NextResponse.json({ error: 'grant_not_found' }, { status: 404 });
  if (grant.user_id !== userId) return NextResponse.json({ error: 'grant_user_mismatch' }, { status: 404 });

  const { data: cap } = await supa
    .from('capabilities').select('id').eq('id', capability_id).maybeSingle();
  if (!cap) return NextResponse.json({ error: 'capability_not_found' }, { status: 400 });

  if (enabled === null) {
    const { error } = await supa
      .from('user_capabilities')
      .delete()
      .eq('grant_id', grantId)
      .eq('capability_id', capability_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ capability_id, enabled: null, deleted: true });
  }

  const { data: row, error } = await supa
    .from('user_capabilities')
    .upsert(
      { grant_id: grantId, capability_id, enabled, granted_by: callerId },
      { onConflict: 'grant_id,capability_id' }
    )
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ capability_id, enabled: row.enabled, override: row });
}
