// lib/rolodexDeps.js
// Dependency counters for company/contact deletes. Used to return 409 with a
// breakdown of what's blocking the delete (matches the Phase 3 sub-DELETE
// pattern). Add an entry to the relevant array if a new FK to companies or
// contacts shows up later — this is the easiest place to keep current.

import { getSupabaseAdmin } from './supabaseServer';

// (table, column) pairs that reference companies(id)
const COMPANY_DEPS = [
  ['subcontracts',         'company_id'],
  ['inspections',          'inspector_company_id'],
  ['coi_records',          'company_id'],
  ['policies',             'agent_company_id'],
  ['project_contacts',     'company_id'],
  ['project_expenses',     'vendor_company_id'],
  ['project_loans',        'lender_company_id'],
  ['projects',             'general_contractor_id'],
  ['property_expenses',    'vendor_company_id'],
  ['maintenance_requests', 'assigned_to_company_id'],
  ['task_assignments',     'assigned_to_company_id'],
  ['contacts',             'company_id']
];

// (table, column) pairs that reference contacts(id)
const CONTACT_DEPS = [
  ['subcontracts',         'contact_id'],
  ['inspections',          'inspector_contact_id'],
  ['policies',             'agent_contact_id'],
  ['project_contacts',     'contact_id'],
  ['project_expenses',     'vendor_contact_id'],
  ['property_expenses',    'vendor_contact_id'],
  ['maintenance_requests', 'assigned_to_contact_id'],
  ['tasks',                'vendor_contact_id']
];

async function countDeps(deps, id) {
  const supa = getSupabaseAdmin();
  const out = {};
  let total = 0;
  for (const [table, col] of deps) {
    const { count } = await supa
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq(col, id);
    if (count && count > 0) {
      out[table] = (out[table] || 0) + count;
      total += count;
    }
  }
  return { total, by_table: out };
}

export async function countCompanyDeps(companyId) {
  return countDeps(COMPANY_DEPS, companyId);
}

export async function countContactDeps(contactId) {
  return countDeps(CONTACT_DEPS, contactId);
}
