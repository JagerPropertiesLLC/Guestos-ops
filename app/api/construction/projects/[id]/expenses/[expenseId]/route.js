// app/api/construction/projects/[id]/expenses/[expenseId]/route.js
// Update + delete an expense.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { assertConstructionAccess } from '@/lib/constructionAuth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const ALLOWED_PAID_STATUSES = ['unpaid', 'submitted', 'approved', 'paid'];
const ALLOWED_FIELDS = [
  'phase_id', 'budget_category_id', 'expense_date', 'amount', 'description',
  'vendor_company_id', 'paid_status', 'paid_date', 'payment_method',
  'payment_reference', 'invoice_number', 'receipt_url', 'notes',
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
  if (update.amount != null && isNaN(Number(update.amount))) {
    return NextResponse.json({ error: 'invalid_amount' }, { status: 400 });
  }
  if (update.amount != null) update.amount = Number(update.amount);
  if (update.paid_status && !ALLOWED_PAID_STATUSES.includes(update.paid_status)) {
    return NextResponse.json({ error: 'invalid_paid_status' }, { status: 400 });
  }
  // If transitioning to 'paid' and no paid_date provided, stamp today
  if (update.paid_status === 'paid' && !('paid_date' in update)) {
    update.paid_date = new Date().toISOString().slice(0, 10);
  }
  // If transitioning away from 'paid', clear paid_date unless explicitly set
  if (update.paid_status && update.paid_status !== 'paid' && !('paid_date' in update)) {
    update.paid_date = null;
  }
  update.updated_at = new Date().toISOString();

  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from('project_expenses')
    .update(update)
    .eq('id', params.expenseId)
    .eq('project_id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ expense: data });
}

export async function DELETE(req, { params }) {
  const callerId = await assertConstructionAccess(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const supa = getSupabaseAdmin();
  const { error } = await supa
    .from('project_expenses')
    .delete()
    .eq('id', params.expenseId)
    .eq('project_id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
