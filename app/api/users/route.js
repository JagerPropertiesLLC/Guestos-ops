// app/api/users/route.js
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export async function GET() {
  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from('app_users')
    .select('id, email, full_name, role, active')
    .eq('active', true)
    .order('full_name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data || [] });
}

export const dynamic = 'force-dynamic';
