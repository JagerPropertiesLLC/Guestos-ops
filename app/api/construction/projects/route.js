// app/api/construction/projects/route.js
// List + create construction projects.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { assertConstructionAccess } from '@/lib/constructionAuth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const ALLOWED_STATUSES = ['planning', 'pre_construction', 'active', 'on_hold', 'complete', 'cancelled'];
const ALLOWED_TYPES = ['new_construction', 'renovation', 'addition', 'tenant_improvement', 'repair', 'demolition', 'other'];

const STATUS_ORDER = { active: 0, pre_construction: 1, planning: 2, on_hold: 3, complete: 4, cancelled: 5 };

export async function GET(req) {
  const callerId = await assertConstructionAccess(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const supa = getSupabaseAdmin();

  const { data: projects, error } = await supa
    .from('projects')
    .select(`
      id, name, type, status, address, total_budget, start_date, target_completion, drive_folder_url,
      property:properties!property_id ( id, short_name, full_address ),
      entity:entities!entity_id ( id, name ),
      market:markets!market_id ( id, name )
    `)
    .order('name', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!projects?.length) return NextResponse.json({ projects: [] });

  const ids = projects.map(p => p.id);
  const [finRes, taskRes, coRes, subRes] = await Promise.all([
    supa.from('project_financials').select('*').in('project_id', ids),
    supa.from('tasks').select('project_id, status').in('project_id', ids),
    supa.from('change_orders').select('project_id, status').in('project_id', ids),
    supa.from('subcontracts').select('project_id').in('project_id', ids),
  ]);

  const finByProj = new Map();
  for (const f of (finRes.data || [])) finByProj.set(f.project_id, f);

  const openTaskCounts = new Map();
  for (const t of (taskRes.data || [])) {
    if (t.status === 'completed' || t.status === 'cancelled') continue;
    openTaskCounts.set(t.project_id, (openTaskCounts.get(t.project_id) || 0) + 1);
  }

  const pendingCoCounts = new Map();
  for (const c of (coRes.data || [])) {
    if (c.status !== 'pending') continue;
    pendingCoCounts.set(c.project_id, (pendingCoCounts.get(c.project_id) || 0) + 1);
  }

  const subCounts = new Map();
  for (const s of (subRes.data || [])) {
    subCounts.set(s.project_id, (subCounts.get(s.project_id) || 0) + 1);
  }

  const enriched = projects.map(p => {
    const f = finByProj.get(p.id) || {};
    return {
      id: p.id,
      name: p.name,
      type: p.type,
      status: p.status,
      address: p.address,
      total_budget: p.total_budget,
      start_date: p.start_date,
      target_completion: p.target_completion,
      drive_folder_url: p.drive_folder_url,
      property_id: p.property?.id || null,
      property_short_name: p.property?.short_name || null,
      property_full_address: p.property?.full_address || null,
      entity_id: p.entity?.id || null,
      entity_name: p.entity?.name || null,
      market_id: p.market?.id || null,
      market_name: p.market?.name || null,
      total_spent: f.total_spent ?? null,
      budget_remaining: f.budget_remaining ?? null,
      pct_budget_spent: f.pct_budget_spent ?? null,
      open_tasks_count: openTaskCounts.get(p.id) || 0,
      pending_change_orders_count: pendingCoCounts.get(p.id) || 0,
      subcontracts_count: subCounts.get(p.id) || 0,
    };
  });

  enriched.sort((a, b) => {
    const ao = STATUS_ORDER[a.status] ?? 99;
    const bo = STATUS_ORDER[b.status] ?? 99;
    if (ao !== bo) return ao - bo;
    return (a.name || '').localeCompare(b.name || '');
  });

  return NextResponse.json({ projects: enriched });
}

export async function POST(req) {
  const callerId = await assertConstructionAccess(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  if (!body.name || !body.name.trim()) {
    return NextResponse.json({ error: 'name_required' }, { status: 400 });
  }
  if (!body.type || !ALLOWED_TYPES.includes(body.type)) {
    return NextResponse.json({ error: 'invalid_type' }, { status: 400 });
  }
  if (!body.market_id) {
    return NextResponse.json({ error: 'market_id_required' }, { status: 400 });
  }
  const status = body.status || 'planning';
  if (!ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
  }

  if (body.property_id && body.entity_id) {
    // Both is fine technically (project has both columns) but we keep them
    // independent — surface a hint to callers if they think it's XOR.
  }

  const insert = {
    name: body.name.trim(),
    type: body.type,
    status,
    market_id: body.market_id,
    property_id: body.property_id || null,
    entity_id: body.entity_id || null,
    address: body.address || null,
    total_budget: body.total_budget ?? null,
    start_date: body.start_date || null,
    target_completion: body.target_completion || null,
    notes: body.notes || null,
    general_contractor_id: body.general_contractor_id || null,
    drive_folder_url: body.drive_folder_url || null,
  };

  const supa = getSupabaseAdmin();
  const { data, error } = await supa.from('projects').insert(insert).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ project: data }, { status: 201 });
}
