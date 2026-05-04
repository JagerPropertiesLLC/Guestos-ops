// app/api/contacts/[id]/linked/route.js
// Records referencing this contact.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(_req, { params }) {
  const supa = getSupabaseAdmin();

  const [subs, inspections, projectContacts, tasks] = await Promise.all([
    supa.from('subcontracts')
      .select('id, project_id, scope, contract_value, status')
      .eq('contact_id', params.id),
    supa.from('inspections')
      .select('id, project_id, inspection_type, scheduled_date, completed_date, result')
      .eq('inspector_contact_id', params.id),
    supa.from('project_contacts')
      .select('id, project_id, role_on_project')
      .eq('contact_id', params.id),
    supa.from('tasks')
      .select('id, project_id, title, status, due_date')
      .eq('vendor_contact_id', params.id)
  ]);

  return NextResponse.json({
    subcontracts:     subs.data || [],
    inspections:      inspections.data || [],
    project_contacts: projectContacts.data || [],
    tasks:            tasks.data || []
  });
}
