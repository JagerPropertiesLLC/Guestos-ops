// app/api/construction/projects/[id]/draws/[drawId]/route.js
// Update + delete a draw.
//
// Status transitions auto-stamp the corresponding date column:
//   * → 'approved' stamps approved_date if blank
//   * → 'paid'     stamps paid_date if blank (and approved_date if also blank)
// Same convention as the expense API.
//
// Note: project_draws has no `updated_at` column (see schema cleanups doc).

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { assertConstructionAccess } from '@/lib/constructionAuth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const ALLOWED_STATUSES = ['pending', 'approved', 'paid', 'rejected', 'cancelled'];
const ALLOWED_TYPES = ['subcontractor', 'loan', 'owner', 'other'];
const ALLOWED_LIEN_TYPES = ['conditional_progress', 'unconditional_progress', 'conditional_final', 'unconditional_final'];
const ALLOWED_FIELDS = [
  'subcontract_id', 'project_loan_id', 'draw_number', 'draw_type', 'amount',
  'retainage_held', 'lien_waiver_received', 'lien_waiver_type', 'status',
  'request_date', 'approved_date', 'paid_date', 'approved_by', 'notes',
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
  if ('draw_type' in update && !ALLOWED_TYPES.includes(update.draw_type)) {
    return NextResponse.json({ error: 'invalid_draw_type' }, { status: 400 });
  }
  if ('amount' in update) {
    const v = Number(update.amount);
    if (isNaN(v) || v < 0) {
      return NextResponse.json({ error: 'amount_must_be_nonneg' }, { status: 400 });
    }
    update.amount = v;
  }
  if ('retainage_held' in update && update.retainage_held != null) {
    const v = Number(update.retainage_held);
    if (isNaN(v) || v < 0) {
      return NextResponse.json({ error: 'invalid_retainage_held' }, { status: 400 });
    }
    update.retainage_held = v;
  }
  if ('status' in update && !ALLOWED_STATUSES.includes(update.status)) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
  }
  // Lien waiver type must be allowlisted whenever it's set, OR cleared if
  // lien_waiver_received is being unset.
  if ('lien_waiver_received' in update && !update.lien_waiver_received) {
    if (!('lien_waiver_type' in update)) update.lien_waiver_type = null;
  }
  const lwTypeFinal = ('lien_waiver_type' in update) ? update.lien_waiver_type : undefined;
  if (lwTypeFinal != null && !ALLOWED_LIEN_TYPES.includes(lwTypeFinal)) {
    return NextResponse.json({ error: 'invalid_lien_waiver_type' }, { status: 400 });
  }

  // Auto-stamp dates on status transitions
  const today = new Date().toISOString().slice(0, 10);
  if (update.status === 'approved' && !('approved_date' in update)) {
    update.approved_date = today;
  }
  if (update.status === 'paid') {
    if (!('paid_date'    in update)) update.paid_date    = today;
    if (!('approved_date' in update)) update.approved_date = today; // implies approval happened
  }
  // Stamp approved_by if transitioning to approved/paid and it's not set
  if ((update.status === 'approved' || update.status === 'paid') && !('approved_by' in update)) {
    update.approved_by = callerId;
  }

  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from('project_draws')
    .update(update)
    .eq('id', params.drawId)
    .eq('project_id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ draw: data });
}

export async function DELETE(req, { params }) {
  const callerId = await assertConstructionAccess(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const supa = getSupabaseAdmin();
  const { error } = await supa
    .from('project_draws')
    .delete()
    .eq('id', params.drawId)
    .eq('project_id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
