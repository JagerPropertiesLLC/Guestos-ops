// app/api/construction/projects/[id]/inspections/[inspId]/route.js
// Update + delete a construction inspection.
//
// When PATCH supplies a `result` and `completed_date` is currently null
// (and not being set explicitly), today is auto-stamped to the
// completed_date. Mirrors the expense paid_date convention.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { assertConstructionAccess } from '@/lib/constructionAuth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const ALLOWED_RESULTS = ['passed', 'failed', 'conditional_pass', 'rescheduled'];

// Inlined to avoid cross-route imports — same logic lives in ../route.js
function deriveStatus(row) {
  if (row.result) return row.result;
  if (row.completed_date) return 'completed';
  if (row.scheduled_date) return 'scheduled';
  return 'requested';
}
const ALLOWED_FIELDS = [
  'inspection_type', 'authority', 'inspector_company_id', 'inspector_contact_id',
  'scheduled_date', 'completed_date', 'result', 'failure_notes',
  'followup_required', 'followup_date', 'notes',
];

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
  if ('inspection_type' in update && (!update.inspection_type || !String(update.inspection_type).trim())) {
    return NextResponse.json({ error: 'inspection_type_required' }, { status: 400 });
  }
  if ('inspection_type' in update) update.inspection_type = String(update.inspection_type).trim();
  if ('result' in update && update.result != null && !ALLOWED_RESULTS.includes(update.result)) {
    return NextResponse.json({ error: 'invalid_result' }, { status: 400 });
  }

  // Cross-field: when result is set without an explicit completed_date,
  // stamp today.
  const supa = getSupabaseAdmin();
  if ('result' in update && update.result && !('completed_date' in update)) {
    const { data: cur } = await supa
      .from('inspections')
      .select('completed_date')
      .eq('id', params.inspId)
      .eq('project_id', params.id)
      .maybeSingle();
    if (!cur) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    if (!cur.completed_date) update.completed_date = new Date().toISOString().slice(0, 10);
  }
  update.updated_at = new Date().toISOString();

  const { data, error } = await supa
    .from('inspections')
    .update(update)
    .eq('id', params.inspId)
    .eq('project_id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ inspection: { ...data, status: deriveStatus(data) } });
}

export async function DELETE(req, { params }) {
  const callerId = await assertConstructionAccess(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const supa = getSupabaseAdmin();
  const { error } = await supa
    .from('inspections')
    .delete()
    .eq('id', params.inspId)
    .eq('project_id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
