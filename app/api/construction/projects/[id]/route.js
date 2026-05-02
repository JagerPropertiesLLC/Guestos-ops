// app/api/construction/projects/[id]/route.js
// Project detail (GET) + edit metadata (PATCH).

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { assertConstructionAccess } from '@/lib/constructionAuth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const ALLOWED_STATUSES = ['planning', 'pre_construction', 'active', 'on_hold', 'complete', 'cancelled'];
const ALLOWED_TYPES = ['new_construction', 'renovation', 'addition', 'tenant_improvement', 'repair', 'demolition', 'other'];

const ALLOWED_FIELDS = [
  'name', 'type', 'status',
  'property_id', 'entity_id', 'market_id',
  'address', 'parcel_number',
  'total_budget',
  'start_date', 'target_completion', 'actual_completion',
  'notes', 'general_contractor_id',
  'drive_folder_url',
];

export async function GET(req, { params }) {
  const callerId = await assertConstructionAccess(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { id } = params;
  const supa = getSupabaseAdmin();

  const { data: p, error: pErr } = await supa
    .from('projects')
    .select(`
      id, name, type, status, address, parcel_number, ein,
      total_budget, start_date, target_completion, actual_completion, notes,
      drive_folder_id, drive_folder_url, general_contractor_id,
      property_id, entity_id, market_id, created_at, updated_at,
      property:properties!property_id ( id, short_name, full_address ),
      entity:entities!entity_id ( id, name, slug ),
      market:markets!market_id ( id, name, slug ),
      gc:companies!general_contractor_id ( id, name )
    `)
    .eq('id', id)
    .maybeSingle();
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  if (!p)   return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const [finRes, taskRes, coRes, subRes] = await Promise.all([
    supa.from('project_financials').select('*').eq('project_id', id).maybeSingle(),
    supa.from('tasks').select('status').eq('project_id', id),
    supa.from('change_orders').select('status').eq('project_id', id),
    supa.from('subcontracts').select('id').eq('project_id', id),
  ]);

  const open_tasks       = (taskRes.data || []).filter(t => t.status !== 'completed' && t.status !== 'cancelled').length;
  const pending_cos      = (coRes.data   || []).filter(c => c.status === 'pending').length;
  const subcontracts     = (subRes.data  || []).length;

  return NextResponse.json({
    project: {
      ...p,
      property_short_name:   p.property?.short_name   || null,
      property_full_address: p.property?.full_address || null,
      entity_name:           p.entity?.name           || null,
      market_name:           p.market?.name           || null,
      gc_name:               p.gc?.name               || null,
    },
    financials: finRes.data || null,
    counts: { open_tasks, pending_change_orders: pending_cos, subcontracts },
  });
}

export async function PATCH(req, { params }) {
  const callerId = await assertConstructionAccess(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { id } = params;
  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const update = {};
  for (const k of ALLOWED_FIELDS) if (k in body) update[k] = body[k];
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'no_valid_fields' }, { status: 400 });
  }
  if ('status' in update && !ALLOWED_STATUSES.includes(update.status)) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
  }
  if ('type' in update && !ALLOWED_TYPES.includes(update.type)) {
    return NextResponse.json({ error: 'invalid_type' }, { status: 400 });
  }
  if ('name' in update && (!update.name || !String(update.name).trim())) {
    return NextResponse.json({ error: 'name_required' }, { status: 400 });
  }

  const supa = getSupabaseAdmin();
  const { data, error } = await supa.from('projects').update(update).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)  return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return NextResponse.json({ project: data });
}
