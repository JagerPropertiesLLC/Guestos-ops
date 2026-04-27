// app/api/projects/[id]/route.js
// GET    /api/projects/:id  — full project detail with related counts
// PATCH  /api/projects/:id  — update fields

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { canUserDo, currentUserId } from '@/lib/permissions';

export async function GET(_request, { params }) {
  const { id } = params;
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'No user' }, { status: 401 });

  const supa = getSupabaseAdmin();
  const { data: project, error } = await supa
    .from('projects')
    .select(`
      *,
      entity:entities!entity_id(id, name, slug, ein, state),
      market:markets!market_id(id, name, slug),
      gc:companies!general_contractor_id(id, name, phone, email)
    `)
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  const allowed = await canUserDo(userId, 'view_project_details', {
    entityId: project.entity_id,
    module: 'construction'
  });
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Counts for tabs
  const [{ count: subs_count }, { count: insp_count }, { count: open_insp_count }, { count: swppp_count }, { count: co_count }] =
    await Promise.all([
      supa.from('subcontracts').select('id', { count: 'exact', head: true }).eq('project_id', id),
      supa.from('inspections').select('id', { count: 'exact', head: true }).eq('project_id', id),
      supa.from('inspections').select('id', { count: 'exact', head: true }).eq('project_id', id).is('completed_date', null),
      supa.from('swppp_logs').select('id', { count: 'exact', head: true }).eq('project_id', id),
      supa.from('change_orders').select('id', { count: 'exact', head: true }).eq('project_id', id)
    ]);

  return NextResponse.json({
    project,
    counts: {
      subcontracts: subs_count || 0,
      inspections: insp_count || 0,
      open_inspections: open_insp_count || 0,
      swppp_logs: swppp_count || 0,
      change_orders: co_count || 0
    }
  });
}

export async function PATCH(request, { params }) {
  const { id } = params;
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'No user' }, { status: 401 });

  const supa = getSupabaseAdmin();
  const { data: existing } = await supa.from('projects').select('entity_id').eq('id', id).single();
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const allowed = await canUserDo(userId, 'view_project_details', {
    entityId: existing.entity_id,
    module: 'construction'
  });
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const allowedFields = [
    'name', 'type', 'address', 'parcel_number', 'status',
    'start_date', 'target_completion', 'actual_completion',
    'total_budget', 'total_spent', 'general_contractor_id', 'notes'
  ];
  const update = {};
  for (const f of allowedFields) if (f in body) update[f] = body[f];

  const { data, error } = await supa
    .from('projects')
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ project: data });
}
