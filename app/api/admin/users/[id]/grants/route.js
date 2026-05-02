// app/api/admin/users/[id]/grants/route.js
// Create a new grant for a user. POST only.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { assertSuperAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const ALLOWED_MODULES = ['str', 'ltr', 'construction', 'marina'];
const ALLOWED_ROLES   = ['owner', 'manager', 'ops', 'viewer'];

export async function POST(req, { params }) {
  const callerId = await assertSuperAdmin(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { id: userId } = params;
  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const { property_id, entity_id, module, role } = body || {};
  if (!ALLOWED_MODULES.includes(module)) return NextResponse.json({ error: 'invalid_module' }, { status: 400 });
  if (!ALLOWED_ROLES.includes(role))     return NextResponse.json({ error: 'invalid_role' }, { status: 400 });
  if ((property_id && entity_id) || (!property_id && !entity_id)) {
    return NextResponse.json({ error: 'must_specify_exactly_one_of_property_or_entity' }, { status: 400 });
  }

  const supa = getSupabaseAdmin();

  const { data: targetUser } = await supa.from('app_users').select('id').eq('id', userId).maybeSingle();
  if (!targetUser) return NextResponse.json({ error: 'user_not_found' }, { status: 404 });

  if (property_id) {
    const { data: prop } = await supa.from('properties').select('id').eq('id', property_id).maybeSingle();
    if (!prop) return NextResponse.json({ error: 'property_not_found' }, { status: 400 });
  } else {
    const { data: ent } = await supa.from('entities').select('id').eq('id', entity_id).maybeSingle();
    if (!ent) return NextResponse.json({ error: 'entity_not_found' }, { status: 400 });
  }

  const { data: grant, error } = await supa
    .from('user_access_grants')
    .insert({
      user_id: userId,
      property_id: property_id || null,
      entity_id:   entity_id   || null,
      module,
      role,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ grant }, { status: 201 });
}
