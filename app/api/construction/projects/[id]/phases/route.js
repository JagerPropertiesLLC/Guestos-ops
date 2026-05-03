// app/api/construction/projects/[id]/phases/route.js
// List + create phases for a project.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { assertConstructionAccess } from '@/lib/constructionAuth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const ALLOWED_STATUSES = ['not_started', 'in_progress', 'complete', 'on_hold', 'delayed'];

export async function GET(req, { params }) {
  const callerId = await assertConstructionAccess(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from('project_phases')
    .select('id, project_id, name, sequence, planned_start, planned_end, actual_start, actual_end, status, budgeted_amount, notes, created_at, updated_at')
    .eq('project_id', params.id)
    .order('sequence', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const phaseIds = (data || []).map(p => p.id);
  let spentByPhase = new Map();
  if (phaseIds.length) {
    const { data: exp } = await supa
      .from('project_expenses')
      .select('phase_id, amount, paid_status')
      .in('phase_id', phaseIds);
    for (const e of (exp || [])) {
      if (e.paid_status !== 'paid') continue;
      const cur = spentByPhase.get(e.phase_id) || 0;
      spentByPhase.set(e.phase_id, cur + Number(e.amount || 0));
    }
  }

  const enriched = (data || []).map(p => ({
    ...p,
    spent: spentByPhase.get(p.id) || 0,
  }));

  return NextResponse.json({ phases: enriched });
}

export async function POST(req, { params }) {
  const callerId = await assertConstructionAccess(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  if (!body.name || !body.name.trim()) {
    return NextResponse.json({ error: 'name_required' }, { status: 400 });
  }
  const status = body.status || 'not_started';
  if (!ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
  }

  const supa = getSupabaseAdmin();

  // Auto-assign sequence = max(sequence)+1 if not provided
  let sequence = body.sequence;
  if (sequence == null) {
    const { data: max } = await supa
      .from('project_phases')
      .select('sequence')
      .eq('project_id', params.id)
      .order('sequence', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    sequence = (max?.sequence ?? -1) + 1;
  }

  const insert = {
    project_id: params.id,
    name: body.name.trim(),
    sequence,
    status,
    planned_start: body.planned_start || null,
    planned_end: body.planned_end || null,
    actual_start: body.actual_start || null,
    actual_end: body.actual_end || null,
    budgeted_amount: body.budgeted_amount ?? 0,
    notes: body.notes || null,
  };

  const { data, error } = await supa.from('project_phases').insert(insert).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ phase: data }, { status: 201 });
}
