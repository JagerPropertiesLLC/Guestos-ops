// app/api/users/route.js
// Public-ish roster used by /scheduler to populate "who can be assigned" dropdowns.
// NOT the admin view — see /api/admin/users for the privileged endpoint.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export async function GET() {
  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from('app_users')
    .select('id, email, full_name, user_type, active')
    .eq('active', true)
    .order('full_name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data || [] });
}

export const dynamic = 'force-dynamic';
