// lib/permissions.js
// Wrapper around the user_has_capability() SQL function.
// Use this in every API route that touches sensitive data.
//
// Usage:
//   import { canUserDo, currentUserId } from '@/lib/permissions';
//   const userId = await currentUserId(req);
//   const allowed = await canUserDo(userId, 'view_pl_report', { entityId, module: 'construction' });
//   if (!allowed) return new Response('Forbidden', { status: 403 });

import { getSupabaseAdmin } from './supabaseServer';

// Until Supabase Auth is wired up, we treat every request as coming from the super_admin (Judson).
// Once auth is wired in, replace this with the real session lookup.
const HARDCODED_SUPER_ADMIN_EMAIL = 'judson@duracoproperties.com';

export async function currentUserId(/* req */) {
  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from('app_users')
    .select('id')
    .eq('email', HARDCODED_SUPER_ADMIN_EMAIL)
    .eq('active', true)
    .single();
  if (error || !data) {
    console.error('[permissions] Could not resolve current user id:', error);
    return null;
  }
  return data.id;
}

export async function canUserDo(userId, capabilitySlug, { entityId, module }) {
  if (!userId) return false;
  const supa = getSupabaseAdmin();
  const { data, error } = await supa.rpc('user_has_capability', {
    p_user_id: userId,
    p_capability_slug: capabilitySlug,
    p_entity_id: entityId,
    p_module: module
  });
  if (error) {
    console.error('[permissions] RPC error:', error);
    return false;
  }
  return data === true;
}

// Returns the list of entity IDs the user can see for a given module.
// For super_admin / management-company stakeholders, returns all entity IDs.
// For others, returns entity IDs they're either stakeholders of OR have a grant on.
export async function visibleEntityIds(userId, module) {
  const supa = getSupabaseAdmin();

  const { data: userRow } = await supa.from('app_users').select('user_type').eq('id', userId).single();
  if (userRow?.user_type === 'super_admin') {
    const { data } = await supa.from('entities').select('id');
    return (data || []).map((r) => r.id);
  }

  // Management-company stakeholders see everything
  const { data: mgmtCheck } = await supa
    .from('entity_stakeholders')
    .select('entity_id, entities!inner(manages_entities)')
    .eq('user_id', userId)
    .is('terminated_date', null);
  const managesAll = (mgmtCheck || []).some((r) => r.entities?.manages_entities === true);
  if (managesAll) {
    const { data } = await supa.from('entities').select('id');
    return (data || []).map((r) => r.id);
  }

  // Otherwise: stakeholder rows + grants
  const stakeholderIds = (mgmtCheck || []).map((r) => r.entity_id);
  const { data: grants } = await supa
    .from('user_access_grants')
    .select('entity_id')
    .eq('user_id', userId)
    .eq('module', module);
  const grantIds = (grants || []).map((r) => r.entity_id).filter(Boolean);

  return Array.from(new Set([...stakeholderIds, ...grantIds]));
}
