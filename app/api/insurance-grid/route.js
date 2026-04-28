// app/api/insurance-grid/route.js
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export async function GET() {
  const supa = getSupabaseAdmin();

  const { data: properties = [] } = await supa
    .from('properties')
    .select('id, short_name, full_address, entity:entities!entity_id(name, slug)')
    .order('short_name');

  const { data: policies = [] } = await supa
    .from('policies')
    .select('id, policy_type, parent_type, parent_id, expiration_date, insurer, coverage_amount, status')
    .eq('status', 'active');

  // For each property, determine status of each coverage type
  const COVERAGE_TYPES = ['property', 'liability', 'umbrella', 'builders_risk'];
  const todayMs = Date.now();

  function statusOf(expDate) {
    if (!expDate) return 'missing';
    const days = Math.floor((new Date(expDate).getTime() - todayMs) / 86400000);
    if (days < 0) return 'expired';
    if (days <= 14) return 'critical';
    if (days <= 30) return 'warn';
    if (days <= 60) return 'soon';
    return 'ok';
  }

  const rows = properties.map(p => {
    const cells = {};
    for (const cType of COVERAGE_TYPES) {
      const match = policies.find(pol =>
        pol.policy_type === cType &&
        ((pol.parent_type === 'property' && pol.parent_id === p.id) ||
         (pol.parent_type === 'entity' && p.entity?.slug && pol.parent_id))
      );
      if (match) {
        cells[cType] = {
          status: statusOf(match.expiration_date),
          expiration_date: match.expiration_date,
          insurer: match.insurer,
          coverage_amount: match.coverage_amount,
          policy_id: match.id
        };
      } else {
        cells[cType] = { status: 'missing' };
      }
    }
    return { property: p, cells };
  });

  // COIs by company
  const { data: companies = [] } = await supa
    .from('companies')
    .select('id, name, type, primary_market_id, market:markets!primary_market_id(slug, name)')
    .in('type', ['general_contractor', 'sub'])
    .order('name');

  const { data: cois = [] } = await supa
    .from('coi_records')
    .select('id, company_id, expiration_date, general_liability_amount, workers_comp_amount, status')
    .in('status', ['active', 'pending_renewal']);

  const coiRows = companies.map(c => {
    const match = cois.find(coi => coi.company_id === c.id);
    return {
      company: c,
      coi: match ? {
        ...match,
        status: statusOf(match.expiration_date)
      } : { status: 'missing' }
    };
  });

  return NextResponse.json({
    coverage_types: COVERAGE_TYPES,
    property_rows: rows,
    coi_rows: coiRows
  });
}

export const dynamic = 'force-dynamic';
