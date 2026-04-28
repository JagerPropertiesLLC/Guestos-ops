// app/api/sidebar-nav/route.js
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export async function GET() {
  const supa = getSupabaseAdmin();

  // Properties: each one tagged str or ltr based on a heuristic for now.
  // Existing 5 Pueblo are STR. Kalamath is LTR + has its own renovation project.
  // Real apps later: tag explicitly with module; for now we compute on the fly.
  const { data: rawProps } = await supa
    .from('properties')
    .select('id, short_name, full_address, entity_id, market_id, entity:entities!entity_id(slug, name)')
    .order('short_name');

  const properties = (rawProps || []).map(p => {
    const isKalamath = p.entity?.slug === 'kalamath_personal';
    return { ...p, module: isKalamath ? 'ltr' : 'str' };
  });

  const { data: projects } = await supa
    .from('projects')
    .select('id, name, status')
    .order('name');

  return NextResponse.json({ properties, projects: projects || [] });
}
