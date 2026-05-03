// app/api/construction/projects/[id]/budget-categories/route.js
// List + create budget categories. List response includes per-category
// spent rollup (sum of paid expenses tagged to that category).

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { assertConstructionAccess } from '@/lib/constructionAuth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(req, { params }) {
  const callerId = await assertConstructionAccess(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from('project_budget_categories')
    .select('id, project_id, name, sequence, budgeted_amount, notes, created_at, updated_at')
    .eq('project_id', params.id)
    .order('sequence', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (data || []).map(c => c.id);
  const spentPaid = new Map();
  const spentUnpaid = new Map();
  if (ids.length) {
    const { data: exp } = await supa
      .from('project_expenses')
      .select('budget_category_id, amount, paid_status')
      .in('budget_category_id', ids);
    for (const e of (exp || [])) {
      const amt = Number(e.amount || 0);
      if (e.paid_status === 'paid') {
        spentPaid.set(e.budget_category_id, (spentPaid.get(e.budget_category_id) || 0) + amt);
      } else {
        spentUnpaid.set(e.budget_category_id, (spentUnpaid.get(e.budget_category_id) || 0) + amt);
      }
    }
  }

  const enriched = (data || []).map(c => {
    const paid = spentPaid.get(c.id) || 0;
    const unpaid = spentUnpaid.get(c.id) || 0;
    const budgeted = Number(c.budgeted_amount || 0);
    return {
      ...c,
      spent_paid: paid,
      spent_unpaid: unpaid,
      remaining: budgeted - paid,
      pct_spent: budgeted > 0 ? Math.round((paid / budgeted) * 1000) / 10 : null,
    };
  });

  return NextResponse.json({ categories: enriched });
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

  const supa = getSupabaseAdmin();

  let sequence = body.sequence;
  if (sequence == null) {
    const { data: max } = await supa
      .from('project_budget_categories')
      .select('sequence')
      .eq('project_id', params.id)
      .order('sequence', { ascending: false })
      .limit(1)
      .maybeSingle();
    sequence = (max?.sequence ?? -1) + 1;
  }

  const insert = {
    project_id: params.id,
    name: body.name.trim(),
    sequence,
    budgeted_amount: body.budgeted_amount ?? 0,
    notes: body.notes || null,
  };

  const { data, error } = await supa.from('project_budget_categories').insert(insert).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ category: data }, { status: 201 });
}
