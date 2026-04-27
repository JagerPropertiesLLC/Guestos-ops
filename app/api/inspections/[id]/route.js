// app/api/inspections/[id]/route.js
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { canUserDo, currentUserId } from '@/lib/permissions';

export async function PATCH(request, { params }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'No user' }, { status: 401 });

  const supa = getSupabaseAdmin();
  const { data: insp } = await supa
    .from('inspections')
    .select('*, project:projects!project_id(entity_id)')
    .eq('id', params.id)
    .single();
  if (!insp) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const isCompletion = body.completed_date !== undefined || body.result !== undefined;
  const cap = isCompletion ? 'mark_inspection_complete' : 'schedule_inspections';
  const allowed = await canUserDo(userId, cap, {
    entityId: insp.project.entity_id, module: 'construction'
  });
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const fields = ['inspection_type','authority','scheduled_date','completed_date','result','failure_notes','followup_required','followup_date','inspector_company_id','inspector_contact_id','notes'];
  const update = {};
  for (const f of fields) if (f in body) update[f] = body[f];

  const { data, error } = await supa
    .from('inspections')
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ inspection: data });
}

export async function DELETE(_req, { params }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'No user' }, { status: 401 });

  const supa = getSupabaseAdmin();
  const { data: insp } = await supa
    .from('inspections')
    .select('project:projects!project_id(entity_id)')
    .eq('id', params.id)
    .single();
  if (!insp) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const allowed = await canUserDo(userId, 'schedule_inspections', {
    entityId: insp.project.entity_id, module: 'construction'
  });
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { error } = await supa.from('inspections').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
