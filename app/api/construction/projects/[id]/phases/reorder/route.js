// app/api/construction/projects/[id]/phases/reorder/route.js
// Bulk-update sequence values for phases. Body: { phaseIds: string[] } in
// the new order. Sequence is reassigned 0..n-1.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { assertConstructionAccess } from '@/lib/constructionAuth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function POST(req, { params }) {
  const callerId = await assertConstructionAccess(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const ids = Array.isArray(body.phaseIds) ? body.phaseIds : null;
  if (!ids || !ids.length) return NextResponse.json({ error: 'phaseIds_required' }, { status: 400 });

  const supa = getSupabaseAdmin();
  const now = new Date().toISOString();

  // Update each phase in the project; skip rows that don't belong (defensive — eq project_id guards).
  const errors = [];
  for (let i = 0; i < ids.length; i++) {
    const { error } = await supa
      .from('project_phases')
      .update({ sequence: i, updated_at: now })
      .eq('id', ids[i])
      .eq('project_id', params.id);
    if (error) errors.push({ id: ids[i], message: error.message });
  }

  if (errors.length) return NextResponse.json({ error: 'partial_failure', failures: errors }, { status: 500 });
  return NextResponse.json({ ok: true });
}
