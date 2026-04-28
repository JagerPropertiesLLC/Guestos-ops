// app/api/swppp/projects/route.js
// GET /api/swppp/projects?project_id=<construction project id>
// Returns the swppp_project for that construction project (or null)

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export async function GET(request) {
  const supa = getSupabaseAdmin();
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('project_id');
  if (!projectId) return NextResponse.json({ error: 'project_id required' }, { status: 400 });

  const { data, error } = await supa
    .from('swppp_projects')
    .select('id, project_id, active, inspection_schedule, public_qr_active, public_qr_token')
    .eq('project_id', projectId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ swppp: data });
}

export const dynamic = 'force-dynamic';
