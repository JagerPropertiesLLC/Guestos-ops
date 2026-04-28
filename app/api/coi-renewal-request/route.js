// app/api/coi-renewal-request/route.js
// Stub: drafts a renewal email and queues for approval.
// Real implementation: composes the email with Claude, queues in a held_emails table, lets user approve/edit/send.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export async function POST(request) {
  const supa = getSupabaseAdmin();
  const { company_id } = await request.json();
  if (!company_id) return NextResponse.json({ error: 'company_id required' }, { status: 400 });

  // Mark the COI as last_renewal_request_sent so we don't double-fire
  const { data: coi } = await supa
    .from('coi_records')
    .select('id, expiration_date, company:companies!company_id(name, email)')
    .eq('company_id', company_id)
    .order('expiration_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (coi) {
    await supa
      .from('coi_records')
      .update({ last_renewal_request_sent: new Date().toISOString() })
      .eq('id', coi.id);
  }

  return NextResponse.json({
    queued: true,
    company: coi?.company?.name,
    will_send_to: coi?.company?.email,
    expiration_date: coi?.expiration_date,
    note: 'Email approval queue UI not yet built. Once wired, this drafts an email for your review.'
  });
}
