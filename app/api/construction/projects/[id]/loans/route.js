// app/api/construction/projects/[id]/loans/route.js
// List + create project loans. List joins the `project_loan_status` view,
// which computes drawn_to_date / available_balance / pct_drawn from
// project_draws (paid only). Always read rollups from the view, never from
// the loans table directly.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { assertConstructionAccess } from '@/lib/constructionAuth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const ALLOWED_STATUSES = ['active', 'paid_off', 'refinanced', 'defaulted', 'closed'];

export async function GET(req, { params }) {
  const callerId = await assertConstructionAccess(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const supa = getSupabaseAdmin();

  const { data: loans, error } = await supa
    .from('project_loans')
    .select(`
      id, project_id, lender_company_id, lender_name, loan_number,
      total_loan_amount, interest_rate, origination_date, maturity_date,
      status, document_id, notes, created_at, updated_at,
      lender:companies!lender_company_id ( id, name )
    `)
    .eq('project_id', params.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Pull rollups from the view in one shot, indexed by loan_id
  const ids = (loans || []).map(l => l.id);
  const rollups = new Map();
  if (ids.length) {
    const { data: rows } = await supa
      .from('project_loan_status')
      .select('loan_id, drawn_to_date, available_balance, pct_drawn')
      .in('loan_id', ids);
    for (const r of (rows || [])) rollups.set(r.loan_id, r);
  }

  const enriched = (loans || []).map(l => {
    const r = rollups.get(l.id) || {};
    return {
      ...l,
      lender_display_name: l.lender?.name || l.lender_name || null,
      drawn_to_date:    Number(r.drawn_to_date    ?? 0),
      available_balance:Number(r.available_balance?? Number(l.total_loan_amount || 0)),
      pct_drawn:        r.pct_drawn ?? 0,
    };
  });

  return NextResponse.json({ loans: enriched });
}

export async function POST(req, { params }) {
  const callerId = await assertConstructionAccess(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  if (body.total_loan_amount == null || isNaN(Number(body.total_loan_amount))) {
    return NextResponse.json({ error: 'total_loan_amount_required' }, { status: 400 });
  }
  if (Number(body.total_loan_amount) <= 0) {
    return NextResponse.json({ error: 'total_loan_amount_must_be_positive' }, { status: 400 });
  }
  const status = body.status || 'active';
  if (!ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
  }
  if (body.interest_rate != null && !isNaN(Number(body.interest_rate))) {
    const ir = Number(body.interest_rate);
    if (ir < 0 || ir > 100) {
      return NextResponse.json({ error: 'invalid_interest_rate' }, { status: 400 });
    }
  }

  const supa = getSupabaseAdmin();

  // Mirror the picked company name into lender_name so list display works
  // even if the joined company is later renamed/removed.
  let lenderName = body.lender_name || null;
  if (body.lender_company_id && !lenderName) {
    const { data: co } = await supa
      .from('companies').select('name').eq('id', body.lender_company_id).maybeSingle();
    if (co?.name) lenderName = co.name;
  }

  const insert = {
    project_id: params.id,
    lender_company_id: body.lender_company_id || null,
    lender_name: lenderName,
    loan_number: body.loan_number || null,
    total_loan_amount: Number(body.total_loan_amount),
    interest_rate: body.interest_rate == null ? null : Number(body.interest_rate),
    origination_date: body.origination_date || null,
    maturity_date: body.maturity_date || null,
    status,
    notes: body.notes || null,
  };

  const { data, error } = await supa.from('project_loans').insert(insert).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ loan: data }, { status: 201 });
}
