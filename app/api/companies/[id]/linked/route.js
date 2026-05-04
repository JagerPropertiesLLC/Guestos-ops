// app/api/companies/[id]/linked/route.js
// Returns records that reference this company (subcontracts, inspections, COIs,
// project_contacts). Used by the company detail page's "Linked Records" tab.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(_req, { params }) {
  const supa = getSupabaseAdmin();

  const [subs, inspections, cois, projectContacts] = await Promise.all([
    supa.from('subcontracts')
      .select('id, project_id, scope, contract_value, status')
      .eq('company_id', params.id)
      .order('created_at', { ascending: false }),
    supa.from('inspections')
      .select('id, project_id, inspection_type, scheduled_date, completed_date, result')
      .eq('inspector_company_id', params.id)
      .order('scheduled_date', { ascending: false, nullsFirst: false }),
    supa.from('coi_records')
      .select('id, project_id, insurer, policy_number, expiration_date, status')
      .eq('company_id', params.id)
      .order('expiration_date', { ascending: false }),
    supa.from('project_contacts')
      .select('id, project_id, role_on_project')
      .eq('company_id', params.id)
  ]);

  return NextResponse.json({
    subcontracts:     subs.data || [],
    inspections:      inspections.data || [],
    coi_records:      cois.data || [],
    project_contacts: projectContacts.data || []
  });
}
