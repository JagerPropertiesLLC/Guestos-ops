// app/api/construction/projects/[id]/change-orders/route.js
// List + create change orders.
//
// Negative `amount` is allowed — credit COs (subcontractor refunds work)
// are real. UI renders negative amounts in red.
//
// `co_number` is text and nullable. If not provided, API auto-generates
// 'CO-001', 'CO-002', … per project (text comparison, not int — extracted
// from the highest existing CO-### number; gaps are not backfilled).
//
// Note: change_orders has no `updated_at` column (see schema cleanups doc).

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { assertConstructionAccess } from '@/lib/constructionAuth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const ALLOWED_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'];

export async function GET(req, { params }) {
  const callerId = await assertConstructionAccess(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const subId  = url.searchParams.get('subcontract_id');
  const phaseId = url.searchParams.get('phase_id');

  const supa = getSupabaseAdmin();
  let q = supa
    .from('change_orders')
    .select(`
      id, project_id, subcontract_id, phase_id, co_number, description,
      amount, schedule_impact_days, status, requested_date, approved_date,
      notes, created_at,
      subcontract:subcontracts!subcontract_id ( id, scope, company:companies!company_id ( id, name ) ),
      phase:project_phases!phase_id ( id, name )
    `)
    .eq('project_id', params.id)
    .order('created_at', { ascending: false });

  if (status && ALLOWED_STATUSES.includes(status)) q = q.eq('status', status);
  if (subId   === 'null') q = q.is('subcontract_id', null);
  else if (subId)         q = q.eq('subcontract_id', subId);
  if (phaseId === 'null') q = q.is('phase_id', null);
  else if (phaseId)       q = q.eq('phase_id', phaseId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ change_orders: data || [] });
}

export async function POST(req, { params }) {
  const callerId = await assertConstructionAccess(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  if (!body.description || !String(body.description).trim()) {
    return NextResponse.json({ error: 'description_required' }, { status: 400 });
  }
  if (body.amount == null || isNaN(Number(body.amount))) {
    return NextResponse.json({ error: 'amount_required' }, { status: 400 });
  }
  const status = body.status || 'pending';
  if (!ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
  }

  const supa = getSupabaseAdmin();

  // Auto-assign co_number = next CO-### per project if not provided
  let coNumber = body.co_number;
  if (!coNumber) {
    const { data: existing } = await supa
      .from('change_orders')
      .select('co_number')
      .eq('project_id', params.id);
    let maxNum = 0;
    for (const row of (existing || [])) {
      const m = (row.co_number || '').match(/^CO-(\d+)$/i);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }
    coNumber = `CO-${String(maxNum + 1).padStart(3, '0')}`;
  }

  const today = new Date().toISOString().slice(0, 10);
  const insert = {
    project_id: params.id,
    subcontract_id: body.subcontract_id || null,
    phase_id: body.phase_id || null,
    co_number: coNumber,
    description: String(body.description).trim(),
    amount: Number(body.amount),
    schedule_impact_days: body.schedule_impact_days == null ? 0 : Number(body.schedule_impact_days),
    status,
    requested_date: body.requested_date || (status === 'pending' ? today : null),
    approved_date:  body.approved_date  || (status === 'approved' ? today : null),
    notes: body.notes || null,
  };

  const { data, error } = await supa.from('change_orders').insert(insert).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ change_order: data }, { status: 201 });
}
