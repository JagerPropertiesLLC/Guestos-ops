// app/api/construction/projects/[id]/change-orders/[coId]/route.js
// Update + delete a change order. Auto-stamps approved_date on transition
// to 'approved' if blank. (No updated_at column on change_orders.)

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { assertConstructionAccess } from '@/lib/constructionAuth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const ALLOWED_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'];
const ALLOWED_FIELDS = [
  'subcontract_id', 'phase_id', 'co_number', 'description', 'amount',
  'schedule_impact_days', 'status', 'requested_date', 'approved_date', 'notes',
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
  if ('description' in update && (!update.description || !String(update.description).trim())) {
    return NextResponse.json({ error: 'description_required' }, { status: 400 });
  }
  if ('description' in update) update.description = String(update.description).trim();
  if ('amount' in update) {
    if (update.amount == null || isNaN(Number(update.amount))) {
      return NextResponse.json({ error: 'invalid_amount' }, { status: 400 });
    }
    update.amount = Number(update.amount);
  }
  if ('schedule_impact_days' in update && update.schedule_impact_days != null) {
    update.schedule_impact_days = Number(update.schedule_impact_days);
  }
  if ('status' in update && !ALLOWED_STATUSES.includes(update.status)) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
  }

  // Auto-stamp approved_date on transition to 'approved' if blank
  const today = new Date().toISOString().slice(0, 10);
  if (update.status === 'approved' && !('approved_date' in update)) {
    update.approved_date = today;
  }

  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from('change_orders')
    .update(update)
    .eq('id', params.coId)
    .eq('project_id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ change_order: data });
}

export async function DELETE(req, { params }) {
  const callerId = await assertConstructionAccess(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const supa = getSupabaseAdmin();
  const { error } = await supa
    .from('change_orders')
    .delete()
    .eq('id', params.coId)
    .eq('project_id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
