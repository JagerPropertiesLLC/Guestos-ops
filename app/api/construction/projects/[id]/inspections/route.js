// app/api/construction/projects/[id]/inspections/route.js
// List + create construction inspections (NOT SWPPP — those live in
// `swppp_inspections` and have their own /api/swppp/* routes).
//
// The `inspections` table has no `status` column — lifecycle is implied by
// the combination of `scheduled_date`, `completed_date`, and `result`. The
// API returns a derived `status` field on every row for UI ease, but
// doesn't persist it. See deriveStatus().
//
// On PATCH, when `result` is supplied without a `completed_date`, today's
// date is auto-stamped (same convention as expense `paid_date`).

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { assertConstructionAccess } from '@/lib/constructionAuth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const ALLOWED_RESULTS = ['passed', 'failed', 'conditional_pass', 'rescheduled'];

// Same logic also lives inline in [inspId]/route.js (cross-route imports
// are brittle in Next.js route handlers).
function deriveStatus(row) {
  if (row.result) return row.result;
  if (row.completed_date) return 'completed';
  if (row.scheduled_date) return 'scheduled';
  return 'requested';
}

export async function GET(req, { params }) {
  const callerId = await assertConstructionAccess(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from('inspections')
    .select(`
      id, project_id, inspection_type, authority,
      inspector_company_id, inspector_contact_id,
      scheduled_date, completed_date, result, failure_notes,
      followup_required, followup_date, notes, created_at, updated_at,
      inspector:companies!inspector_company_id ( id, name )
    `)
    .eq('project_id', params.id)
    .order('scheduled_date', { ascending: false, nullsFirst: false })
    .order('created_at',     { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const enriched = (data || []).map(r => ({
    ...r,
    inspector_name: r.inspector?.name || null,
    status: deriveStatus(r),
  }));
  return NextResponse.json({ inspections: enriched });
}

export async function POST(req, { params }) {
  const callerId = await assertConstructionAccess(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  if (!body.inspection_type || !String(body.inspection_type).trim()) {
    return NextResponse.json({ error: 'inspection_type_required' }, { status: 400 });
  }
  if (body.result && !ALLOWED_RESULTS.includes(body.result)) {
    return NextResponse.json({ error: 'invalid_result' }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const insert = {
    project_id: params.id,
    inspection_type: String(body.inspection_type).trim(),
    authority: body.authority || null,
    inspector_company_id: body.inspector_company_id || null,
    inspector_contact_id: body.inspector_contact_id || null,
    scheduled_date: body.scheduled_date || null,
    completed_date: body.completed_date || (body.result ? today : null),
    result: body.result || null,
    failure_notes: body.failure_notes || null,
    followup_required: !!body.followup_required,
    followup_date: body.followup_date || null,
    notes: body.notes || null,
  };

  const supa = getSupabaseAdmin();
  const { data, error } = await supa.from('inspections').insert(insert).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ inspection: { ...data, status: deriveStatus(data) } }, { status: 201 });
}
