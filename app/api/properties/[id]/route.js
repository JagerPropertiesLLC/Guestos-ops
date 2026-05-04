// app/api/properties/[id]/route.js
// Property metadata + units + entity + market for the property detail page.
// Distinct from /api/admin/properties/[id] which is the RBAC-scoped admin view.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(_req, { params }) {
  const supa = getSupabaseAdmin();

  const { data: property, error } = await supa
    .from('properties')
    .select(`
      id, short_name, full_address, property_type, notes,
      is_cam_property, total_rentable_sf,
      drive_folder_id, drive_folder_url, created_at,
      entity:entities!entity_id ( id, name, slug ),
      market:markets!market_id ( id, slug, name )
    `)
    .eq('id', params.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!property) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data: units } = await supa
    .from('units')
    .select('id, unit_label, rental_type, bedrooms, bathrooms, sleeps, active')
    .eq('property_id', params.id)
    .order('unit_label');

  const isStr = (property.property_type || []).includes('str');
  const isLtr = (property.property_type || []).includes('ltr');

  return NextResponse.json({
    property: { ...property, is_str: isStr, is_ltr: isLtr },
    units: units || []
  });
}
