// app/api/construction/projects/[id]/budget-categories/[catId]/route.js
// Update + delete a budget category.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { assertConstructionAccess } from '@/lib/constructionAuth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const ALLOWED_FIELDS = ['name', 'sequence', 'budgeted_amount', 'notes'];

export async function PATCH(req, { params }) {
  const callerId = await assertConstructionAccess(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const update = {};
  for (const k of ALLOWED_FIELDS) {
    if (k in body) update[k] = body[k];
  }
  if (update.name != null && (!update.name || !String(update.name).trim())) {
    return NextResponse.json({ error: 'name_required' }, { status: 400 });
  }
  if (update.name) update.name = String(update.name).trim();
  update.updated_at = new Date().toISOString();

  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from('project_budget_categories')
    .update(update)
    .eq('id', params.catId)
    .eq('project_id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ category: data });
}

export async function DELETE(req, { params }) {
  const callerId = await assertConstructionAccess(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const supa = getSupabaseAdmin();

  // Detach expenses tagged to this category rather than block delete
  await supa
    .from('project_expenses')
    .update({ budget_category_id: null })
    .eq('budget_category_id', params.catId)
    .eq('project_id', params.id);

  const { error } = await supa
    .from('project_budget_categories')
    .delete()
    .eq('id', params.catId)
    .eq('project_id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
