// app/api/projects/route.js
// GET  /api/projects        — list construction projects user can see
// POST /api/projects        — create new project

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { canUserDo, currentUserId, visibleEntityIds } from '@/lib/permissions';

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'No user' }, { status: 401 });

  const entityIds = await visibleEntityIds(userId, 'construction');
  if (entityIds.length === 0) return NextResponse.json({ projects: [] });

  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from('projects')
    .select(`
      id, name, status, type, address, entity_name, total_budget, total_spent,
      start_date, target_completion, actual_completion,
      entity:entities!entity_id(id, name, slug),
      market:markets!market_id(id, name, slug)
    `)
    .in('entity_id', entityIds)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ projects: data });
}

export async function POST(request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'No user' }, { status: 401 });

  const body = await request.json();
  const { name, entity_id, market_id, type, address, status, total_budget, target_completion, notes } = body;

  if (!name || !entity_id || !market_id || !type) {
    return NextResponse.json({ error: 'name, entity_id, market_id, type are required' }, { status: 400 });
  }

  const allowed = await canUserDo(userId, 'view_project_list', { entityId: entity_id, module: 'construction' });
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supa = getSupabaseAdmin();

  // Pull entity_name from the entity for snapshot
  const { data: ent } = await supa.from('entities').select('name').eq('id', entity_id).single();

  const { data, error } = await supa
    .from('projects')
    .insert({
      name,
      entity_id,
      market_id,
      entity_name: ent?.name,
      type,
      address: address || null,
      status: status || 'active',
      total_budget: total_budget || null,
      target_completion: target_completion || null,
      notes: notes || null
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ project: data });
}
