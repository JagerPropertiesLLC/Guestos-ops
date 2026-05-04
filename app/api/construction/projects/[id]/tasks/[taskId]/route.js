// app/api/construction/projects/[id]/tasks/[taskId]/route.js
// Update + delete a task scoped to a construction project.
// Auto-stamps completed_at on transition into 'completed', clears it on
// transition away.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { assertConstructionAccess } from '@/lib/constructionAuth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const ALLOWED_STATUSES   = ['pending', 'in_progress', 'completed', 'cancelled'];
const ALLOWED_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const ALLOWED_FIELDS = [
  'phase_id', 'subcontract_id', 'task_type', 'title', 'description',
  'status', 'priority', 'due_date', 'scheduled_time', 'assigned_to_id',
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
  if ('title' in update && (!update.title || !String(update.title).trim())) {
    return NextResponse.json({ error: 'title_required' }, { status: 400 });
  }
  if ('title' in update) update.title = String(update.title).trim();
  if ('status' in update && !ALLOWED_STATUSES.includes(update.status)) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
  }
  if ('priority' in update && !ALLOWED_PRIORITIES.includes(update.priority)) {
    return NextResponse.json({ error: 'invalid_priority' }, { status: 400 });
  }

  // Stamp / clear completed_at on status transition into / out of 'completed'
  if ('status' in update) {
    if (update.status === 'completed') update.completed_at = new Date().toISOString();
    else                                update.completed_at = null;
  }
  update.updated_at = new Date().toISOString();

  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from('tasks')
    .update(update)
    .eq('id', params.taskId)
    .eq('project_id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ task: data });
}

export async function DELETE(req, { params }) {
  const callerId = await assertConstructionAccess(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const supa = getSupabaseAdmin();
  const { error } = await supa
    .from('tasks')
    .delete()
    .eq('id', params.taskId)
    .eq('project_id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
