// app/api/construction/lookups/route.js
// Markets + properties + entities + companies + active app_users for project
// create/edit + task assignee dropdowns.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { assertConstructionAccess } from '@/lib/constructionAuth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(req) {
  const callerId = await assertConstructionAccess(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const supa = getSupabaseAdmin();
  const [m, p, e, c, u] = await Promise.all([
    supa.from('markets').select('id, name, slug').order('name'),
    supa.from('properties').select('id, short_name, full_address, entity_id').order('short_name'),
    supa.from('entities').select('id, name, slug').order('name'),
    supa.from('companies').select('id, name').order('name').limit(500),
    supa.from('app_users').select('id, full_name, email').eq('active', true).order('full_name'),
  ]);

  return NextResponse.json({
    markets:    m.data || [],
    properties: p.data || [],
    entities:   e.data || [],
    companies:  c.data || [],
    app_users:  u.data || [],
  });
}
