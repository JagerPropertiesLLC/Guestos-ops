// app/api/construction/projects/[id]/phases/[phaseId]/route.js
// Update + delete a phase.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { assertConstructionAccess } from '@/lib/constructionAuth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const ALLOWED_STATUSES = ['not_started', 'in_progress', 'complete', 'on_hold', 'delayed'];
const ALLOWED_FIELDS = ['name', 'status', 'sequence', 'planned_start', 'planned_end', 'actual_start', 'actual_end', 'budgeted_amount', 'notes'];

export async function PATCH(req, { params }) {
  const callerId = await assertConstructionAccess(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const update = {};
  for (const k of ALLOWED_FIELDS) {
    if (k in body) update[k] = body[k];
  }
  if (update.name != null && (!update.name || !String(update.name).trim())) {
    return NextResponse.json({ error: 'name_required' }, { status: 400 });
  }
  if (update.name) update.name = String(update.name).trim();
  if (update.status && !ALLOWED_STATUSES.includes(update.status)) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
  }
  update.updated_at = new Date().toISOString();

  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from('project_phases')
    .update(update)
    .eq('id', params.phaseId)
    .eq('project_id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ phase: data });
}

export async function DELETE(req, { params }) {
  const callerId = await assertConstructionAccess(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const supa = getSupabaseAdmin();

  // Detach any expenses tagged to this phase rather than blocking
  await supa
    .from('project_expenses')
    .update({ phase_id: null })
    .eq('phase_id', params.phaseId)
    .eq('project_id', params.id);

  const { error } = await supa
    .from('project_phases')
    .delete()
    .eq('id', params.phaseId)
    .eq('project_id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
