// app/api/construction/projects/[id]/subcontracts/[subId]/route.js
// Detail (with embedded line items + rollups), update, delete.
//
// On DELETE, line items cascade automatically via FK ON DELETE CASCADE.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { assertConstructionAccess } from '@/lib/constructionAuth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const ALLOWED_STATUSES = ['draft', 'signed', 'in_progress', 'complete', 'terminated'];
const ALLOWED_FIELDS = [
  'company_id', 'contact_id', 'scope', 'contract_value', 'retainage_pct',
  'status', 'contract_signed_date', 'notes',
];

export async function GET(req, { params }) {
  const callerId = await assertConstructionAccess(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const supa = getSupabaseAdmin();

  const { data: sub, error: sErr } = await supa
    .from('subcontracts')
    .select(`
      id, project_id, company_id, contact_id, scope, contract_value,
      retainage_pct, status, contract_signed_date, notes, created_at, updated_at,
      vendor:companies!company_id ( id, name )
    `)
    .eq('id', params.subId)
    .eq('project_id', params.id)
    .maybeSingle();
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
  if (!sub)  return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data: lines, error: lErr } = await supa
    .from('subcontract_line_items')
    .select('id, subcontract_id, sequence, description, contract_amount, paid_to_date, remaining_balance, pct_complete, retainage_held, notes, created_at, updated_at')
    .eq('subcontract_id', sub.id)
    .order('sequence', { ascending: true })
    .order('created_at', { ascending: true });
  if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 });

  // Rollups computed from line items (header denormalized cols intentionally ignored)
  let amountPaid = 0;
  let amountRetained = 0;
  let weightedNum = 0;
  let weightedDenom = 0;
  for (const l of (lines || [])) {
    amountPaid     += Number(l.paid_to_date   || 0);
    amountRetained += Number(l.retainage_held || 0);
    const ca = Number(l.contract_amount || 0);
    weightedNum   += ca * Number(l.pct_complete || 0);
    weightedDenom += ca;
  }
  const contractValue = Number(sub.contract_value || 0);

  return NextResponse.json({
    subcontract: {
      ...sub,
      vendor_name: sub.vendor?.name || null,
      amount_paid: amountPaid,
      amount_retained: amountRetained,
      remaining_balance: contractValue - amountPaid,
      pct_complete: weightedDenom > 0 ? Math.round((weightedNum / weightedDenom) * 10) / 10 : 0,
    },
    line_items: lines || [],
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
  if ('scope' in update && (!update.scope || !String(update.scope).trim())) {
    return NextResponse.json({ error: 'scope_required' }, { status: 400 });
  }
  if ('scope' in update) update.scope = String(update.scope).trim();
  if ('contract_value' in update) {
    if (update.contract_value == null || isNaN(Number(update.contract_value))) {
      return NextResponse.json({ error: 'invalid_contract_value' }, { status: 400 });
    }
    update.contract_value = Number(update.contract_value);
  }
  if ('retainage_pct' in update && update.retainage_pct != null) {
    update.retainage_pct = Number(update.retainage_pct);
  }
  if ('status' in update && !ALLOWED_STATUSES.includes(update.status)) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
  }
  update.updated_at = new Date().toISOString();

  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from('subcontracts')
    .update(update)
    .eq('id', params.subId)
    .eq('project_id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ subcontract: data });
}

export async function DELETE(req, { params }) {
  const callerId = await assertConstructionAccess(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const supa = getSupabaseAdmin();

  // Both project_draws.subcontract_id and change_orders.subcontract_id are
  // FK ON DELETE NO ACTION — bare DELETE on a sub with either dependent
  // would 500 with a raw FK violation. Pre-check both and return a clean
  // 409 with the counts so the UI can surface them.
  const [drawsRes, cosRes] = await Promise.all([
    supa.from('project_draws').select('id', { count: 'exact', head: true }).eq('subcontract_id', params.subId),
    supa.from('change_orders' ).select('id', { count: 'exact', head: true }).eq('subcontract_id', params.subId),
  ]);
  if (drawsRes.error) return NextResponse.json({ error: drawsRes.error.message }, { status: 500 });
  if (cosRes.error)   return NextResponse.json({ error: cosRes.error.message },   { status: 500 });

  const drawCount = drawsRes.count ?? 0;
  const coCount   = cosRes.count   ?? 0;
  if (drawCount > 0 || coCount > 0) {
    return NextResponse.json(
      { error: 'has_dependents', counts: { draws: drawCount, change_orders: coCount } },
      { status: 409 }
    );
  }

  const { error } = await supa
    .from('subcontracts')
    .delete()
    .eq('id', params.subId)
    .eq('project_id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
