// app/api/construction/projects/[id]/expenses/route.js
// List + create expenses. List supports filter query params:
//   ?phase_id=..&budget_category_id=..&paid_status=..&vendor_company_id=..
// Filter values can be 'null' literal to filter for IS NULL (e.g. untagged).

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { assertConstructionAccess } from '@/lib/constructionAuth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const ALLOWED_PAID_STATUSES = ['unpaid', 'submitted', 'approved', 'paid'];

export async function GET(req, { params }) {
  const callerId = await assertConstructionAccess(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const phaseId   = url.searchParams.get('phase_id');
  const catId     = url.searchParams.get('budget_category_id');
  const paid      = url.searchParams.get('paid_status');
  const vendorId  = url.searchParams.get('vendor_company_id');

  const supa = getSupabaseAdmin();
  let q = supa
    .from('project_expenses')
    .select(`
      id, project_id, phase_id, budget_category_id, expense_date, amount, description,
      vendor_company_id, paid_status, paid_date, payment_method, payment_reference,
      invoice_number, receipt_url, notes, created_at, updated_at,
      vendor:companies!vendor_company_id ( id, name ),
      phase:project_phases!phase_id ( id, name ),
      category:project_budget_categories!budget_category_id ( id, name )
    `)
    .eq('project_id', params.id)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (phaseId === 'null') q = q.is('phase_id', null);
  else if (phaseId) q = q.eq('phase_id', phaseId);

  if (catId === 'null') q = q.is('budget_category_id', null);
  else if (catId) q = q.eq('budget_category_id', catId);

  if (paid && ALLOWED_PAID_STATUSES.includes(paid)) q = q.eq('paid_status', paid);

  if (vendorId === 'null') q = q.is('vendor_company_id', null);
  else if (vendorId) q = q.eq('vendor_company_id', vendorId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ expenses: data || [] });
}

export async function POST(req, { params }) {
  const callerId = await assertConstructionAccess(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  if (body.amount == null || isNaN(Number(body.amount))) {
    return NextResponse.json({ error: 'amount_required' }, { status: 400 });
  }
  if (!body.expense_date) {
    return NextResponse.json({ error: 'expense_date_required' }, { status: 400 });
  }
  const paidStatus = body.paid_status || 'unpaid';
  if (!ALLOWED_PAID_STATUSES.includes(paidStatus)) {
    return NextResponse.json({ error: 'invalid_paid_status' }, { status: 400 });
  }

  const insert = {
    project_id: params.id,
    phase_id: body.phase_id || null,
    budget_category_id: body.budget_category_id || null,
    expense_date: body.expense_date,
    amount: Number(body.amount),
    description: body.description || null,
    vendor_company_id: body.vendor_company_id || null,
    paid_status: paidStatus,
    paid_date: body.paid_date || (paidStatus === 'paid' ? body.expense_date : null),
    payment_method: body.payment_method || null,
    payment_reference: body.payment_reference || null,
    invoice_number: body.invoice_number || null,
    receipt_url: body.receipt_url || null,
    notes: body.notes || null,
    entered_by: callerId,
  };

  const supa = getSupabaseAdmin();
  const { data, error } = await supa.from('project_expenses').insert(insert).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ expense: data }, { status: 201 });
}
