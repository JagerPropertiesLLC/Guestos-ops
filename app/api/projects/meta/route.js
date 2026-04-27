// app/api/projects/meta/route.js
// Returns entities + markets for use in dropdowns.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { currentUserId, visibleEntityIds } from '@/lib/permissions';

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'No user' }, { status: 401 });

  const supa = getSupabaseAdmin();
  const visibleIds = await visibleEntityIds(userId, 'construction');

  const { data: entities } = await supa
    .from('entities')
    .select('id, name, slug, kind')
    .in('id', visibleIds.length ? visibleIds : ['00000000-0000-0000-0000-000000000000'])
    .neq('kind', 'management')   // don't let users assign projects to the mgmt company
    .order('name');

  const { data: markets } = await supa
    .from('markets')
    .select('id, name, slug')
    .order('name');

  return NextResponse.json({ entities: entities || [], markets: markets || [] });
}
