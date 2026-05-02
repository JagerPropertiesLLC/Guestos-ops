// app/api/admin/properties/[id]/route.js
// Property detail with super-admins, direct access, and indirect access (entity
// grants + stakeholders). Read-only — writes go through existing
// /api/admin/users/[id]/grants endpoints.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { assertSuperAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(req, { params }) {
  const callerId = await assertSuperAdmin(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { id } = params;
  const supa = getSupabaseAdmin();

  const { data: prop, error: propErr } = await supa
    .from('properties')
    .select(`
      id, short_name, full_address, property_type, is_cam_property, total_rentable_sf,
      entity_id, market_id, notes,
      entity:entities!entity_id ( id, name, slug )
    `)
    .eq('id', id)
    .maybeSingle();
  if (propErr) return NextResponse.json({ error: propErr.message }, { status: 500 });
  if (!prop)   return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { count: unitCount } = await supa
    .from('units').select('id', { count: 'exact', head: true }).eq('property_id', id);

  const { data: superAdmins, error: saErr } = await supa
    .from('app_users')
    .select('id, full_name, email')
    .eq('user_type', 'super_admin')
    .eq('active', true)
    .order('full_name');
  if (saErr) return NextResponse.json({ error: saErr.message }, { status: 500 });

  const { data: direct, error: dErr } = await supa
    .from('user_access_grants')
    .select(`
      id, module, role, created_at,
      user:app_users!user_access_grants_user_id_fkey ( id, full_name, email, user_type, active ),
      overrides:user_capabilities!user_capabilities_grant_id_fkey ( id, capability_id, enabled, capability:capabilities!capability_id ( slug, label ) )
    `)
    .eq('property_id', id);
  if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 });

  const direct_access = (direct || [])
    .filter(g => g.user && g.user.active && g.user.user_type !== 'super_admin')
    .map(g => ({
      user: g.user,
      grant: {
        id: g.id,
        module: g.module,
        role: g.role,
        overrides: (g.overrides || []).map(o => ({
          id: o.id,
          capability_id:    o.capability_id,
          capability_slug:  o.capability?.slug,
          capability_label: o.capability?.label,
          enabled: o.enabled,
        })),
      },
    }));

  const indirect_access = [];
  if (prop.entity_id) {
    const [{ data: entityGrants }, { data: stakeholders }] = await Promise.all([
      supa
        .from('user_access_grants')
        .select('id, module, role, user:app_users!user_access_grants_user_id_fkey ( id, full_name, email, user_type, active )')
        .eq('entity_id', prop.entity_id),
      supa
        .from('entity_stakeholders')
        .select('id, software_role, legal_role, can_edit, terminated_date, user:app_users!entity_stakeholders_user_id_fkey ( id, full_name, email, user_type, active )')
        .eq('entity_id', prop.entity_id)
        .is('terminated_date', null),
    ]);

    const entityName = prop.entity?.name || 'Entity';
    const seen = new Set(direct_access.map(d => d.user.id));

    for (const g of (entityGrants || [])) {
      if (!g.user || !g.user.active) continue;
      if (g.user.user_type === 'super_admin') continue;
      if (seen.has(g.user.id)) continue;
      seen.add(g.user.id);
      indirect_access.push({
        user: g.user,
        source: 'entity_grant',
        source_label: `${g.role} on ${g.module.toUpperCase()} via ${entityName}`,
        role: g.role,
        module: g.module,
        entity_id: prop.entity_id,
        entity_name: entityName,
      });
    }
    for (const s of (stakeholders || [])) {
      if (!s.user || !s.user.active) continue;
      if (s.user.user_type === 'super_admin') continue;
      if (seen.has(s.user.id)) continue;
      seen.add(s.user.id);
      indirect_access.push({
        user: s.user,
        source: 'stakeholder',
        source_label: `Stakeholder of ${entityName}${s.software_role ? ` (${s.software_role})` : ''}`,
        role: s.software_role || null,
        module: null,
        entity_id: prop.entity_id,
        entity_name: entityName,
      });
    }
  }

  return NextResponse.json({
    property: {
      id: prop.id,
      short_name: prop.short_name,
      full_address: prop.full_address,
      property_type: prop.property_type || [],
      is_cam_property: !!prop.is_cam_property,
      total_rentable_sf: prop.total_rentable_sf,
      entity_id: prop.entity_id,
      entity_name: prop.entity?.name || null,
      entity_slug: prop.entity?.slug || null,
      notes: prop.notes,
      unit_count: unitCount || 0,
    },
    super_admins: superAdmins || [],
    direct_access,
    indirect_access,
  });
}
