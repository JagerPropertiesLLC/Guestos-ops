// app/api/insurance/route.js
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export async function GET(request) {
  const supa = getSupabaseAdmin();
  const { searchParams } = new URL(request.url);
  const filterModule = searchParams.get('module'); // 'str' | 'ltr' | 'construction' | null

  // Get policies
  let policiesQuery = supa.from('policies').select(`
    id, policy_type, insurer, policy_number, coverage_amount, deductible, premium_annual,
    effective_date, expiration_date, named_insured, additional_insureds, status,
    parent_type, parent_id,
    agent_company:companies!agent_company_id(id, name),
    agent:contacts!agent_contact_id(id, first_name, last_name, phone, email)
  `).order('expiration_date', { ascending: true });

  const { data: policies = [] } = await policiesQuery;

  // Hydrate parent name
  const policiesHydrated = await Promise.all(policies.map(async (p) => {
    let parentName = null;
    if (p.parent_type === 'entity') {
      const { data } = await supa.from('entities').select('name').eq('id', p.parent_id).single();
      parentName = data?.name;
    } else if (p.parent_type === 'property') {
      const { data } = await supa.from('properties').select('short_name, full_address').eq('id', p.parent_id).single();
      parentName = data?.short_name;
    } else if (p.parent_type === 'project') {
      const { data } = await supa.from('projects').select('name').eq('id', p.parent_id).single();
      parentName = data?.name;
    }
    return { ...p, parent_name: parentName };
  }));

  // Get COIs
  const { data: cois = [] } = await supa.from('coi_records').select(`
    id, insurer, policy_number,
    general_liability_amount, auto_liability_amount, workers_comp_amount, umbrella_amount,
    effective_date, expiration_date, named_additional_insured,
    agent_email, agent_phone, status, last_renewal_request_sent,
    company:companies!company_id(id, name, primary_market_id),
    project:projects!project_id(id, name)
  `).order('expiration_date', { ascending: true });

  // Compute days until expiration for each
  const todayMs = Date.now();
  const withDays = (arr) => arr.map(item => {
    const exp = new Date(item.expiration_date).getTime();
    const days = Math.floor((exp - todayMs) / 86400000);
    let badge = 'ok';
    if (days < 0) badge = 'expired';
    else if (days <= 14) badge = 'critical';
    else if (days <= 30) badge = 'warn';
    else if (days <= 60) badge = 'soon';
    return { ...item, days_until_expiration: days, expiration_badge: badge };
  });

  return NextResponse.json({
    policies: withDays(policiesHydrated),
    cois: withDays(cois)
  });
}
