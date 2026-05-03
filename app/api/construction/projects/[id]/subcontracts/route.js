// app/api/construction/projects/[id]/subcontracts/route.js
// List + create subcontracts. List includes computed rollups from line items
// (amount_paid, amount_retained, remaining_balance, pct_complete).
//
// Naming asymmetry to know about: the SUBCONTRACT header stores the total as
// `contract_value`, but each LINE ITEM stores its scheduled value as
// `contract_amount`. Both come straight from the schema. The UI normalizes
// these to AIA G702/G703 terminology ("Contract amount" for the header,
// "Scheduled value" for the line item) but the API + DB keep the original
// names. See project_pending_schema_cleanups.md for tracked follow-ups.
//
// Denormalized columns `subcontracts.amount_paid` and
// `subcontracts.amount_retained` are intentionally NOT read or written here —
// computed values from line items are authoritative.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { assertConstructionAccess } from '@/lib/constructionAuth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const ALLOWED_STATUSES = ['draft', 'signed', 'in_progress', 'complete', 'terminated'];

export async function GET(req, { params }) {
  const callerId = await assertConstructionAccess(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const supa = getSupabaseAdmin();

  const { data: subs, error } = await supa
    .from('subcontracts')
    .select(`
      id, project_id, company_id, contact_id, scope, contract_value,
      retainage_pct, status, contract_signed_date, notes, created_at, updated_at,
      vendor:companies!company_id ( id, name )
    `)
    .eq('project_id', params.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Pull all line items for these subcontracts in one query, then aggregate.
  const ids = (subs || []).map(s => s.id);
  const rollups = new Map(); // sub.id -> { amount_paid, amount_retained, weighted_pct_num, weighted_pct_denom }
  if (ids.length) {
    const { data: lines } = await supa
      .from('subcontract_line_items')
      .select('subcontract_id, contract_amount, paid_to_date, retainage_held, pct_complete')
      .in('subcontract_id', ids);
    for (const l of (lines || [])) {
      const r = rollups.get(l.subcontract_id) || { amount_paid: 0, amount_retained: 0, weighted_num: 0, weighted_denom: 0 };
      r.amount_paid     += Number(l.paid_to_date   || 0);
      r.amount_retained += Number(l.retainage_held || 0);
      // Dollar-weighted pct_complete: sum(contract_amount * pct) / sum(contract_amount)
      const ca = Number(l.contract_amount || 0);
      r.weighted_num   += ca * Number(l.pct_complete || 0);
      r.weighted_denom += ca;
      rollups.set(l.subcontract_id, r);
    }
  }

  const enriched = (subs || []).map(s => {
    const r = rollups.get(s.id) || { amount_paid: 0, amount_retained: 0, weighted_num: 0, weighted_denom: 0 };
    const contractValue = Number(s.contract_value || 0);
    return {
      ...s,
      vendor_name: s.vendor?.name || null,
      amount_paid: r.amount_paid,
      amount_retained: r.amount_retained,
      remaining_balance: contractValue - r.amount_paid,
      pct_complete: r.weighted_denom > 0
        ? Math.round((r.weighted_num / r.weighted_denom) * 10) / 10
        : 0,
    };
  });

  return NextResponse.json({ subcontracts: enriched });
}

export async function POST(req, { params }) {
  const callerId = await assertConstructionAccess(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  if (!body.scope || !String(body.scope).trim()) {
    return NextResponse.json({ error: 'scope_required' }, { status: 400 });
  }
  if (body.contract_value == null || isNaN(Number(body.contract_value))) {
    return NextResponse.json({ error: 'contract_value_required' }, { status: 400 });
  }
  const status = body.status || 'draft';
  if (!ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
  }

  const insert = {
    project_id: params.id,
    company_id: body.company_id || null,
    contact_id: body.contact_id || null,
    scope: String(body.scope).trim(),
    contract_value: Number(body.contract_value),
    retainage_pct: body.retainage_pct == null ? 10.00 : Number(body.retainage_pct),
    status,
    contract_signed_date: body.contract_signed_date || null,
    notes: body.notes || null,
  };

  const supa = getSupabaseAdmin();
  const { data, error } = await supa.from('subcontracts').insert(insert).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ subcontract: data }, { status: 201 });
}
