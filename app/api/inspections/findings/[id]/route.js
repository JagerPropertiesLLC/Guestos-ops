// app/api/inspections/findings/[id]/route.js
//
// PATCH  /api/inspections/findings/:id  — edit any column except inspection_id
// DELETE /api/inspections/findings/:id  — remove finding (cascade clears any
//   pending_charges/pending_insurance_claims via SET NULL)

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

const FINDING_TYPES = ['damage', 'missing', 'extra_cleaning', 'other'];
const SEVERITIES = ['minor', 'moderate', 'major'];
const CHARGE_TO = ['guest', 'none', 'tbd'];

export async function PATCH(request, { params }) {
  const { id } = params;
  const body = await request.json();
  const update = {};

  if (typeof body.description === 'string') update.description = body.description;
  if (body.finding_type !== undefined) {
    if (!FINDING_TYPES.includes(body.finding_type)) {
      return NextResponse.json({ error: `invalid finding_type` }, { status: 400 });
    }
    update.finding_type = body.finding_type;
  }
  if (body.severity !== undefined) {
    if (!SEVERITIES.includes(body.severity)) {
      return NextResponse.json({ error: `invalid severity` }, { status: 400 });
    }
    update.severity = body.severity;
  }
  if (body.charge_to !== undefined) {
    if (!CHARGE_TO.includes(body.charge_to)) {
      return NextResponse.json({ error: `invalid charge_to` }, { status: 400 });
    }
    update.charge_to = body.charge_to;
  }
  if (body.estimated_cost_cents !== undefined) update.estimated_cost_cents = body.estimated_cost_cents;
  if (body.claim_eligible !== undefined) update.claim_eligible = !!body.claim_eligible;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  }

  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from('inspection_findings')
    .update(update)
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ finding: data });
}

export async function DELETE(_request, { params }) {
  const { id } = params;
  const supa = getSupabaseAdmin();
  const { error } = await supa.from('inspection_findings').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
