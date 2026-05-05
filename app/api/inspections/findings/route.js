// app/api/inspections/findings/route.js
//
// POST /api/inspections/findings   — create a finding within an inspection
//   { inspection_id, description, finding_type?, severity?, estimated_cost_cents?, charge_to?, claim_eligible? }

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { getSingletonOrgId, currentCallerId } from '@/lib/orgContext';

export const dynamic = 'force-dynamic';

const FINDING_TYPES = ['damage', 'missing', 'extra_cleaning', 'other'];
const SEVERITIES = ['minor', 'moderate', 'major'];
const CHARGE_TO = ['guest', 'none', 'tbd'];

export async function POST(request) {
  const body = await request.json();
  const {
    inspection_id, description,
    finding_type = 'damage', severity = 'minor',
    estimated_cost_cents = null,
    charge_to = 'tbd', claim_eligible = false
  } = body;

  if (!inspection_id || !description) {
    return NextResponse.json({ error: 'inspection_id and description required' }, { status: 400 });
  }
  if (!FINDING_TYPES.includes(finding_type)) {
    return NextResponse.json({ error: `invalid finding_type: ${finding_type}` }, { status: 400 });
  }
  if (!SEVERITIES.includes(severity)) {
    return NextResponse.json({ error: `invalid severity: ${severity}` }, { status: 400 });
  }
  if (!CHARGE_TO.includes(charge_to)) {
    return NextResponse.json({ error: `invalid charge_to: ${charge_to}` }, { status: 400 });
  }

  const supa = getSupabaseAdmin();
  const orgId = await getSingletonOrgId();
  const callerId = await currentCallerId();

  const { data, error } = await supa
    .from('inspection_findings')
    .insert({
      org_id: orgId,
      inspection_id,
      finding_type,
      severity,
      description,
      estimated_cost_cents,
      charge_to,
      claim_eligible,
      created_by: callerId
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ finding: data });
}
