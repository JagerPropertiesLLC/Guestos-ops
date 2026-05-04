// app/api/construction/projects/[id]/loans/[loanId]/route.js
// Loan detail (with rollups + embedded draws) / update / delete.
//
// On DELETE: project_draws.project_loan_id has FK SET NULL — draws survive
// with project_loan_id=null. We don't block. UI confirms first.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { assertConstructionAccess } from '@/lib/constructionAuth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const ALLOWED_STATUSES = ['active', 'paid_off', 'refinanced', 'defaulted', 'closed'];
const ALLOWED_FIELDS = [
  'lender_company_id', 'lender_name', 'loan_number',
  'total_loan_amount', 'interest_rate', 'origination_date', 'maturity_date',
  'status', 'notes',
];

export async function GET(req, { params }) {
  const callerId = await assertConstructionAccess(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const supa = getSupabaseAdmin();

  const { data: loan, error: lErr } = await supa
    .from('project_loans')
    .select(`
      id, project_id, lender_company_id, lender_name, loan_number,
      total_loan_amount, interest_rate, origination_date, maturity_date,
      status, document_id, notes, created_at, updated_at,
      lender:companies!lender_company_id ( id, name )
    `)
    .eq('id', params.loanId)
    .eq('project_id', params.id)
    .maybeSingle();
  if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 });
  if (!loan) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data: status } = await supa
    .from('project_loan_status')
    .select('drawn_to_date, available_balance, pct_drawn')
    .eq('loan_id', loan.id)
    .maybeSingle();

  const { data: draws } = await supa
    .from('project_draws')
    .select(`
      id, project_id, subcontract_id, project_loan_id, draw_number, draw_type,
      amount, retainage_held, lien_waiver_received, lien_waiver_type, status,
      request_date, approved_date, paid_date, approved_by, notes, created_at,
      subcontract:subcontracts!subcontract_id ( id, scope, company:companies!company_id ( id, name ) )
    `)
    .eq('project_loan_id', loan.id)
    .order('created_at', { ascending: false });

  return NextResponse.json({
    loan: {
      ...loan,
      lender_display_name: loan.lender?.name || loan.lender_name || null,
      drawn_to_date:    Number(status?.drawn_to_date    ?? 0),
      available_balance:Number(status?.available_balance?? Number(loan.total_loan_amount || 0)),
      pct_drawn:        status?.pct_drawn ?? 0,
    },
    draws: draws || [],
  });
}

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
  if ('total_loan_amount' in update) {
    const v = Number(update.total_loan_amount);
    if (isNaN(v) || v <= 0) {
      return NextResponse.json({ error: 'total_loan_amount_must_be_positive' }, { status: 400 });
    }
    update.total_loan_amount = v;
  }
  if ('status' in update && !ALLOWED_STATUSES.includes(update.status)) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
  }
  if ('interest_rate' in update && update.interest_rate != null) {
    const ir = Number(update.interest_rate);
    if (isNaN(ir) || ir < 0 || ir > 100) {
      return NextResponse.json({ error: 'invalid_interest_rate' }, { status: 400 });
    }
    update.interest_rate = ir;
  }
  // Re-mirror lender_name when lender_company_id changes (keep display consistent)
  const supa = getSupabaseAdmin();
  if ('lender_company_id' in update && update.lender_company_id && !('lender_name' in update)) {
    const { data: co } = await supa
      .from('companies').select('name').eq('id', update.lender_company_id).maybeSingle();
    if (co?.name) update.lender_name = co.name;
  }
  update.updated_at = new Date().toISOString();

  const { data, error } = await supa
    .from('project_loans')
    .update(update)
    .eq('id', params.loanId)
    .eq('project_id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ loan: data });
}

export async function DELETE(req, { params }) {
  const callerId = await assertConstructionAccess(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const supa = getSupabaseAdmin();
  const { error } = await supa
    .from('project_loans')
    .delete()
    .eq('id', params.loanId)
    .eq('project_id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
