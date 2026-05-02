// app/api/admin/properties/route.js
// Property list with unit counts + direct-grant user counts. Used by the
// settings tab grid and the user-detail grant modal.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { assertSuperAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(req) {
  const callerId = await assertSuperAdmin(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const supa = getSupabaseAdmin();

  const [propsRes, unitsRes, grantsRes] = await Promise.all([
    supa
      .from('properties')
      .select('id, short_name, full_address, property_type, is_cam_property, total_rentable_sf, entity_id, entity:entities!entity_id ( name )')
      .order('short_name'),
    supa
      .from('units')
      .select('property_id'),
    supa
      .from('user_access_grants')
      .select('property_id, user_id, user:app_users!user_access_grants_user_id_fkey ( user_type, active )')
      .not('property_id', 'is', null),
  ]);

  if (propsRes.error)  return NextResponse.json({ error: propsRes.error.message }, { status: 500 });
  if (unitsRes.error)  return NextResponse.json({ error: unitsRes.error.message }, { status: 500 });
  if (grantsRes.error) return NextResponse.json({ error: grantsRes.error.message }, { status: 500 });

  const unitCount = new Map();
  for (const u of (unitsRes.data || [])) {
    unitCount.set(u.property_id, (unitCount.get(u.property_id) || 0) + 1);
  }

  const directUsers = new Map();
  for (const g of (grantsRes.data || [])) {
    if (!g.user || !g.user.active) continue;
    if (g.user.user_type === 'super_admin') continue;
    let s = directUsers.get(g.property_id);
    if (!s) { s = new Set(); directUsers.set(g.property_id, s); }
    s.add(g.user_id);
  }

  return NextResponse.json({
    properties: (propsRes.data || []).map(p => ({
      id: p.id,
      short_name: p.short_name,
      full_address: p.full_address,
      property_type: p.property_type || [],
      is_cam_property: !!p.is_cam_property,
      total_rentable_sf: p.total_rentable_sf,
      entity_id: p.entity_id,
      entity_name: p.entity?.name || null,
      unit_count: unitCount.get(p.id) || 0,
      direct_user_count: directUsers.get(p.id)?.size || 0,
    })),
  });
}
