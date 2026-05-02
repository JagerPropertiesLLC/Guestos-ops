// app/api/construction/lookups/route.js
// Markets + properties + entities + companies for project create/edit dropdowns.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { assertConstructionAccess } from '@/lib/constructionAuth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(req) {
  const callerId = await assertConstructionAccess(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const supa = getSupabaseAdmin();
  const [m, p, e, c] = await Promise.all([
    supa.from('markets').select('id, name, slug').order('name'),
    supa.from('properties').select('id, short_name, full_address, entity_id').order('short_name'),
    supa.from('entities').select('id, name, slug').order('name'),
    supa.from('companies').select('id, name').order('name').limit(500),
  ]);

  return NextResponse.json({
    markets:    m.data || [],
    properties: p.data || [],
    entities:   e.data || [],
    companies:  c.data || [],
  });
}
