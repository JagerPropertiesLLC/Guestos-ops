// app/api/inspections/review-queue/route.js
//
// GET /api/inspections/review-queue
// Convenience: list of inspections awaiting Judson's attention.
//   Default: status='submitted'.
//   ?include_in_progress=1 to also include status='in_progress' (Sam's drafts).

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const includeInProgress = searchParams.get('include_in_progress') === '1';
  const statuses = includeInProgress ? ['submitted', 'in_progress'] : ['submitted'];

  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from('unit_inspections')
    .select(`
      id, status, started_at, completed_at, guest_name, checkout_date, damage_summary,
      properties:property_id ( short_name, full_address ),
      units:unit_id ( unit_label ),
      inspector:app_users!inspected_by ( full_name, email )
    `)
    .in('status', statuses)
    .order('completed_at', { ascending: false, nullsFirst: false })
    .order('started_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (data || []).map(r => r.id);
  let countsById = {};
  if (ids.length > 0) {
    const { data: rows } = await supa
      .from('inspection_findings')
      .select('inspection_id, finding_type, severity, charge_to, claim_eligible, estimated_cost_cents')
      .in('inspection_id', ids);
    for (const f of rows || []) {
      const acc = countsById[f.inspection_id] || {
        total: 0, billable_to_guest: 0, claim_eligible: 0, total_estimated_cents: 0
      };
      acc.total += 1;
      if (f.charge_to === 'guest') acc.billable_to_guest += 1;
      if (f.claim_eligible) acc.claim_eligible += 1;
      if (f.estimated_cost_cents) acc.total_estimated_cents += Number(f.estimated_cost_cents);
      countsById[f.inspection_id] = acc;
    }
  }

  const enriched = (data || []).map(r => ({
    ...r,
    finding_summary: countsById[r.id] || { total: 0, billable_to_guest: 0, claim_eligible: 0, total_estimated_cents: 0 }
  }));

  return NextResponse.json({ inspections: enriched });
}
