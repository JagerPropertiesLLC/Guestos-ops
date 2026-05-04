// app/api/construction/projects/[id]/tasks/route.js
// List + create tasks scoped to a construction project.
//
// The `tasks` table is app-wide (used by cleaning, maintenance, reservation
// flows too). Construction context comes from the nullable `project_id` /
// `phase_id` / `subcontract_id` FKs. Listing filters by `project_id = X`
// regardless of `task_type` so any pre-existing tasks for the project show
// up; new construction-created tasks default to `task_type='construction'`.
//
// `tasks.org_id` is NOT NULL (multi-tenancy implied). Until a real
// per-caller org lookup is wired, we read the singleton row from
// `organizations`. Tracked in project_pending_schema_cleanups.md.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { assertConstructionAccess } from '@/lib/constructionAuth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const ALLOWED_STATUSES   = ['pending', 'in_progress', 'completed', 'cancelled'];
const ALLOWED_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

async function getSingletonOrgId(supa) {
  const { data: org } = await supa.from('organizations').select('id').limit(1).maybeSingle();
  return org?.id || null;
}

export async function GET(req, { params }) {
  const callerId = await assertConstructionAccess(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const status   = url.searchParams.get('status');
  const phaseId  = url.searchParams.get('phase_id');
  const subId    = url.searchParams.get('subcontract_id');
  const assignee = url.searchParams.get('assigned_to_id');

  const supa = getSupabaseAdmin();
  let q = supa
    .from('tasks')
    .select(`
      id, project_id, phase_id, subcontract_id, task_type, title, description,
      status, priority, due_date, scheduled_time, assigned_to_id, created_by_id,
      completed_at, started_at, created_at, updated_at,
      phase:project_phases!phase_id ( id, name ),
      subcontract:subcontracts!subcontract_id ( id, scope, company:companies!company_id ( id, name ) ),
      assignee:app_users!assigned_to_id ( id, full_name, email )
    `)
    .eq('project_id', params.id)
    .order('due_date',   { ascending: true,  nullsFirst: false })
    .order('created_at', { ascending: false });

  if (status   && ALLOWED_STATUSES.includes(status)) q = q.eq('status', status);
  if (phaseId  === 'null') q = q.is('phase_id', null);
  else if (phaseId)        q = q.eq('phase_id', phaseId);
  if (subId    === 'null') q = q.is('subcontract_id', null);
  else if (subId)          q = q.eq('subcontract_id', subId);
  if (assignee === 'null') q = q.is('assigned_to_id', null);
  else if (assignee)       q = q.eq('assigned_to_id', assignee);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tasks: data || [] });
}

export async function POST(req, { params }) {
  const callerId = await assertConstructionAccess(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  if (!body.title || !String(body.title).trim()) {
    return NextResponse.json({ error: 'title_required' }, { status: 400 });
  }
  const status = body.status || 'pending';
  if (!ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
  }
  const priority = body.priority || 'medium';
  if (!ALLOWED_PRIORITIES.includes(priority)) {
    return NextResponse.json({ error: 'invalid_priority' }, { status: 400 });
  }

  const supa = getSupabaseAdmin();
  const orgId = await getSingletonOrgId(supa);
  if (!orgId) return NextResponse.json({ error: 'org_not_found' }, { status: 500 });

  const insert = {
    org_id: orgId,
    project_id: params.id,
    phase_id: body.phase_id || null,
    subcontract_id: body.subcontract_id || null,
    task_type: body.task_type || 'construction',
    title: String(body.title).trim(),
    description: body.description || null,
    status,
    priority,
    due_date: body.due_date || null,
    scheduled_time: body.scheduled_time || null,
    assigned_to_id: body.assigned_to_id || null,
    created_by_id: callerId,
    completed_at: status === 'completed' ? new Date().toISOString() : null,
  };

  const { data, error } = await supa.from('tasks').insert(insert).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data }, { status: 201 });
}
