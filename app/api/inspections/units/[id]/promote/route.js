// app/api/inspections/units/[id]/promote/route.js
//
// POST /api/inspections/units/:id/promote
// Body: { findings: [{ finding_id, action: 'charge'|'claim'|'both', amount_cents?, claim_amount_cents? }, ...], close? }
// Judson's review action: turn approved findings into pending_charges and/or
// pending_insurance_claims rows. Optionally flip inspection to status='reviewed'
// (close=true ⇒ status='closed').

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { getSingletonOrgId, currentCallerId } from '@/lib/orgContext';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  const { id } = params;
  const body = await request.json();
  const findings = Array.isArray(body.findings) ? body.findings : [];
  const closeAfter = !!body.close;

  if (findings.length === 0) {
    return NextResponse.json({ error: 'findings array required' }, { status: 400 });
  }

  const supa = getSupabaseAdmin();
  const orgId = await getSingletonOrgId();
  const callerId = await currentCallerId();

  const { data: inspection } = await supa
    .from('unit_inspections')
    .select('id, reservation_id, property_id, guest_name')
    .eq('id', id)
    .maybeSingle();
  if (!inspection) return NextResponse.json({ error: 'inspection not found' }, { status: 404 });

  // Pull the findings being promoted.
  const findingIds = findings.map(f => f.finding_id).filter(Boolean);
  const { data: rows } = await supa
    .from('inspection_findings')
    .select('id, description, estimated_cost_cents')
    .in('id', findingIds);
  const byId = Object.fromEntries((rows || []).map(r => [r.id, r]));

  const createdCharges = [];
  const createdClaims = [];
  for (const f of findings) {
    const finding = byId[f.finding_id];
    if (!finding) continue;
    const action = f.action;
    if (action === 'charge' || action === 'both') {
      const amt = f.amount_cents != null ? f.amount_cents : finding.estimated_cost_cents;
      if (amt == null) continue;
      const { data: ch } = await supa
        .from('pending_charges')
        .insert({
          org_id: orgId,
          inspection_id: id,
          finding_id: finding.id,
          reservation_id: inspection.reservation_id,
          guest_name: inspection.guest_name,
          amount_cents: amt,
          description: finding.description,
          status: 'pending',
          proposed_by: callerId
        })
        .select()
        .single();
      if (ch) createdCharges.push(ch);
    }
    if (action === 'claim' || action === 'both') {
      const amt = f.claim_amount_cents != null ? f.claim_amount_cents : finding.estimated_cost_cents;
      const { data: cl } = await supa
        .from('pending_insurance_claims')
        .insert({
          org_id: orgId,
          inspection_id: id,
          finding_id: finding.id,
          property_id: inspection.property_id,
          description: finding.description,
          estimated_amount_cents: amt,
          status: 'pending'
        })
        .select()
        .single();
      if (cl) createdClaims.push(cl);
    }
  }

  // Move the inspection along.
  const newStatus = closeAfter ? 'closed' : 'reviewed';
  await supa
    .from('unit_inspections')
    .update({ status: newStatus, reviewed_by: callerId, reviewed_at: new Date().toISOString() })
    .eq('id', id);

  return NextResponse.json({
    ok: true,
    pending_charges: createdCharges,
    pending_insurance_claims: createdClaims,
    inspection_status: newStatus
  });
}
