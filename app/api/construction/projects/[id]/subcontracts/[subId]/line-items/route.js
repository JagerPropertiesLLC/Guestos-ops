// app/api/construction/projects/[id]/subcontracts/[subId]/line-items/route.js
// POST a new line item. List GET intentionally not exposed — the parent
// subcontract detail GET already embeds line items; refresh by re-fetching it.
//
// Naming asymmetry: the LINE ITEM column is `contract_amount` (not
// `scheduled_value`). UI labels say "Scheduled value" per AIA G702/G703.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { assertConstructionAccess } from '@/lib/constructionAuth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function POST(req, { params }) {
  const callerId = await assertConstructionAccess(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  if (!body.description || !String(body.description).trim()) {
    return NextResponse.json({ error: 'description_required' }, { status: 400 });
  }
  const contractAmount = Number(body.contract_amount ?? 0);
  if (isNaN(contractAmount) || contractAmount < 0) {
    return NextResponse.json({ error: 'invalid_contract_amount' }, { status: 400 });
  }
  const paidToDate = Number(body.paid_to_date ?? 0);
  if (isNaN(paidToDate) || paidToDate < 0) {
    return NextResponse.json({ error: 'invalid_paid_to_date' }, { status: 400 });
  }
  if (paidToDate > contractAmount) {
    return NextResponse.json({ error: 'paid_exceeds_scheduled' }, { status: 400 });
  }
  const pctComplete = Number(body.pct_complete ?? 0);
  if (isNaN(pctComplete) || pctComplete < 0 || pctComplete > 100) {
    return NextResponse.json({ error: 'invalid_pct_complete' }, { status: 400 });
  }
  const retainageHeld = Number(body.retainage_held ?? 0);
  if (isNaN(retainageHeld) || retainageHeld < 0) {
    return NextResponse.json({ error: 'invalid_retainage_held' }, { status: 400 });
  }

  const supa = getSupabaseAdmin();

  // Verify subcontract belongs to this project (defensive)
  const { data: parent } = await supa
    .from('subcontracts')
    .select('id')
    .eq('id', params.subId)
    .eq('project_id', params.id)
    .maybeSingle();
  if (!parent) return NextResponse.json({ error: 'subcontract_not_found' }, { status: 404 });

  // Auto-assign sequence = max+1
  let sequence = body.sequence;
  if (sequence == null) {
    const { data: max } = await supa
      .from('subcontract_line_items')
      .select('sequence')
      .eq('subcontract_id', params.subId)
      .order('sequence', { ascending: false })
      .limit(1)
      .maybeSingle();
    sequence = (max?.sequence ?? -1) + 1;
  }

  const insert = {
    subcontract_id: params.subId,
    sequence,
    description: String(body.description).trim(),
    contract_amount: contractAmount,
    paid_to_date: paidToDate,
    pct_complete: pctComplete,
    retainage_held: retainageHeld,
    notes: body.notes || null,
  };

  const { data, error } = await supa.from('subcontract_line_items').insert(insert).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ line_item: data }, { status: 201 });
}
