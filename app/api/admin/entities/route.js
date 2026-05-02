// app/api/admin/entities/route.js
// List of entities for the grant modal dropdown.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { assertSuperAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(req) {
  const callerId = await assertSuperAdmin(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from('entities')
    .select('id, slug, name, kind')
    .order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ entities: data || [] });
}
