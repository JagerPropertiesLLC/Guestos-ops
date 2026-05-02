// app/api/admin/capabilities/route.js
// Capability catalog. Optional ?module=ltr filter narrows to caps that apply
// to the requested module.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { assertSuperAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const callerId = await assertSuperAdmin(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const moduleFilter = searchParams.get('module');

  const supa = getSupabaseAdmin();
  let q = supa
    .from('capabilities')
    .select('id, slug, label, category, applies_to_modules, description, default_owner, default_manager, default_ops, default_viewer, sort_order')
    .order('sort_order');
  if (moduleFilter) q = q.contains('applies_to_modules', [moduleFilter]);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ capabilities: data || [] });
}
