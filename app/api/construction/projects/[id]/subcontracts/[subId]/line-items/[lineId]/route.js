// app/api/construction/projects/[id]/subcontracts/[subId]/line-items/[lineId]/route.js
// Update + delete a single line item.
//
// API enforces `paid_to_date <= contract_amount` because the DB does not
// (only `>= 0` is constrained). When PATCHing one of those two fields, we
// re-fetch the row to compute the post-update value of the other side and
// reject if it would overbill.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { assertConstructionAccess } from '@/lib/constructionAuth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const ALLOWED_FIELDS = [
  'sequence', 'description', 'contract_amount', 'paid_to_date',
  'pct_complete', 'retainage_held', 'notes',
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

  for (const numField of ['contract_amount', 'paid_to_date', 'retainage_held']) {
    if (numField in update) {
      const v = Number(update[numField]);
      if (isNaN(v) || v < 0) {
        return NextResponse.json({ error: `invalid_${numField}` }, { status: 400 });
      }
      update[numField] = v;
    }
  }
  if ('pct_complete' in update) {
    const v = Number(update.pct_complete);
    if (isNaN(v) || v < 0 || v > 100) {
      return NextResponse.json({ error: 'invalid_pct_complete' }, { status: 400 });
    }
    update.pct_complete = v;
  }

  const supa = getSupabaseAdmin();

  // Belongs-to guard + fetch current values for paid<=scheduled cross-field check
  const { data: current } = await supa
    .from('subcontract_line_items')
    .select('id, subcontract_id, contract_amount, paid_to_date, subcontracts!inner(project_id)')
    .eq('id', params.lineId)
    .eq('subcontract_id', params.subId)
    .maybeSingle();
  if (!current || current.subcontracts?.project_id !== params.id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const nextContract = 'contract_amount' in update ? update.contract_amount : Number(current.contract_amount);
  const nextPaid     = 'paid_to_date'    in update ? update.paid_to_date    : Number(current.paid_to_date);
  if (nextPaid > nextContract) {
    return NextResponse.json({ error: 'paid_exceeds_scheduled' }, { status: 400 });
  }

  update.updated_at = new Date().toISOString();

  const { data, error } = await supa
    .from('subcontract_line_items')
    .update(update)
    .eq('id', params.lineId)
    .eq('subcontract_id', params.subId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ line_item: data });
}

export async function DELETE(req, { params }) {
  const callerId = await assertConstructionAccess(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const supa = getSupabaseAdmin();

  // Belongs-to guard via join — must be on a subcontract owned by this project
  const { data: current } = await supa
    .from('subcontract_line_items')
    .select('id, subcontracts!inner(project_id)')
    .eq('id', params.lineId)
    .eq('subcontract_id', params.subId)
    .maybeSingle();
  if (!current || current.subcontracts?.project_id !== params.id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { error } = await supa
    .from('subcontract_line_items')
    .delete()
    .eq('id', params.lineId)
    .eq('subcontract_id', params.subId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
