// app/api/construction/projects/[id]/draws/route.js
// List + create draws. Filter query params:
//   ?status=..&draw_type=..&subcontract_id=..&project_loan_id=..
// Filter values can be 'null' literal to match IS NULL (e.g. unscoped).
//
// On status transitions to 'approved' or 'paid' without an explicit date,
// the corresponding *_date column is auto-stamped to today (matches the
// expense API pattern). draw_number is auto-assigned per-project if absent.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { assertConstructionAccess } from '@/lib/constructionAuth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const ALLOWED_STATUSES = ['pending', 'approved', 'paid', 'rejected', 'cancelled'];
const ALLOWED_TYPES = ['subcontractor', 'loan', 'owner', 'other'];
const ALLOWED_LIEN_TYPES = ['conditional_progress', 'unconditional_progress', 'conditional_final', 'unconditional_final'];

export async function GET(req, { params }) {
  const callerId = await assertConstructionAccess(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const status   = url.searchParams.get('status');
  const drawType = url.searchParams.get('draw_type');
  const subId    = url.searchParams.get('subcontract_id');
  const loanId   = url.searchParams.get('project_loan_id');

  const supa = getSupabaseAdmin();
  let q = supa
    .from('project_draws')
    .select(`
      id, project_id, subcontract_id, project_loan_id, draw_number, draw_type,
      amount, retainage_held, lien_waiver_received, lien_waiver_type, status,
      request_date, approved_date, paid_date, approved_by, notes, created_at,
      subcontract:subcontracts!subcontract_id ( id, scope, company:companies!company_id ( id, name ) ),
      loan:project_loans!project_loan_id ( id, lender_name, loan_number )
    `)
    .eq('project_id', params.id)
    .order('created_at', { ascending: false });

  if (status   && ALLOWED_STATUSES.includes(status))   q = q.eq('status', status);
  if (drawType && ALLOWED_TYPES.includes(drawType))    q = q.eq('draw_type', drawType);
  if (subId  === 'null') q = q.is('subcontract_id', null);
  else if (subId)        q = q.eq('subcontract_id', subId);
  if (loanId === 'null') q = q.is('project_loan_id', null);
  else if (loanId)       q = q.eq('project_loan_id', loanId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ draws: data || [] });
}

export async function POST(req, { params }) {
  const callerId = await assertConstructionAccess(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  if (!body.draw_type || !ALLOWED_TYPES.includes(body.draw_type)) {
    return NextResponse.json({ error: 'invalid_draw_type' }, { status: 400 });
  }
  if (body.amount == null || isNaN(Number(body.amount))) {
    return NextResponse.json({ error: 'amount_required' }, { status: 400 });
  }
  if (Number(body.amount) < 0) {
    return NextResponse.json({ error: 'amount_must_be_nonneg' }, { status: 400 });
  }
  const status = body.status || 'pending';
  if (!ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
  }
  if (body.lien_waiver_received) {
    if (body.lien_waiver_type && !ALLOWED_LIEN_TYPES.includes(body.lien_waiver_type)) {
      return NextResponse.json({ error: 'invalid_lien_waiver_type' }, { status: 400 });
    }
  }

  const supa = getSupabaseAdmin();

  // Auto-assign draw_number = max(draw_number) + 1 across the project
  let drawNumber = body.draw_number;
  if (drawNumber == null) {
    const { data: max } = await supa
      .from('project_draws')
      .select('draw_number')
      .eq('project_id', params.id)
      .order('draw_number', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    drawNumber = (max?.draw_number ?? 0) + 1;
  }

  const today = new Date().toISOString().slice(0, 10);
  const insert = {
    project_id: params.id,
    subcontract_id: body.subcontract_id || null,
    project_loan_id: body.project_loan_id || null,
    draw_number: drawNumber,
    draw_type: body.draw_type,
    amount: Number(body.amount),
    retainage_held: body.retainage_held == null ? 0 : Number(body.retainage_held),
    lien_waiver_received: !!body.lien_waiver_received,
    lien_waiver_type: body.lien_waiver_received ? (body.lien_waiver_type || null) : null,
    status,
    request_date:  body.request_date  || (status === 'pending' ? today : null),
    approved_date: body.approved_date || (status === 'approved' ? today : (status === 'paid' ? today : null)),
    paid_date:     body.paid_date     || (status === 'paid' ? today : null),
    approved_by:   body.approved_by   || (status === 'approved' || status === 'paid' ? callerId : null),
    notes: body.notes || null,
  };

  const { data, error } = await supa.from('project_draws').insert(insert).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ draw: data }, { status: 201 });
}
