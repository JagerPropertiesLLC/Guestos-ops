// app/api/admin/properties/route.js
// List of properties for the grant modal dropdown.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { assertSuperAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const callerId = await assertSuperAdmin(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from('properties')
    .select('id, short_name, full_address, entity_id, entity:entities!entity_id ( name )')
    .order('short_name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    properties: (data || []).map(p => ({
      id: p.id,
      short_name: p.short_name,
      full_address: p.full_address,
      entity_id: p.entity_id,
      entity_name: p.entity?.name || null,
    })),
  });
}
