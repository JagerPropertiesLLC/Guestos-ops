// app/api/dashboard/route.js
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export async function GET() {
  const supa = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const in60 = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);

  // Today's cleaning schedule
  const { count: cleaningTotal } = await supa
    .from('schedule_units')
    .select('id', { count: 'exact', head: true })
    .eq('cleaning_date', today)
    .catch(() => ({ count: 0 }));

  // Open inspections (any project)
  const { count: openInspections } = await supa
    .from('inspections')
    .select('id', { count: 'exact', head: true })
    .is('completed_date', null);

  // Inspections this week
  const inWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const { count: inspectionsThisWeek } = await supa
    .from('inspections')
    .select('id', { count: 'exact', head: true })
    .gte('scheduled_date', today)
    .lte('scheduled_date', inWeek)
    .is('completed_date', null);

  // Expiring policies in next 60 days
  const { count: policiesExpiringSoon } = await supa
    .from('policies')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
    .lte('expiration_date', in60);

  // Expiring COIs in next 30 days
  const { count: coiExpiringSoon } = await supa
    .from('coi_records')
    .select('id', { count: 'exact', head: true })
    .in('status', ['active', 'pending_renewal'])
    .lte('expiration_date', in30);

  // Active leases
  const { count: activeLeases } = await supa
    .from('leases')
    .select('id', { count: 'exact', head: true })
    .eq('renewal_status', 'active');

  // Active subcontracts
  const { count: activeSubcontracts } = await supa
    .from('subcontracts')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active');

  // Active reminders (due in next 30 days)
  const { count: upcomingReminders } = await supa
    .from('reminders')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
    .lte('due_date', in30);

  // Total counts
  const { count: properties } = await supa.from('properties').select('id', { count: 'exact', head: true });
  const { count: entities } = await supa.from('entities').select('id', { count: 'exact', head: true });
  const { count: projects } = await supa.from('projects').select('id', { count: 'exact', head: true }).eq('status', 'active');

  return NextResponse.json({
    today,
    cleaning: { today_count: cleaningTotal || 0 },
    construction: {
      open_inspections: openInspections || 0,
      inspections_this_week: inspectionsThisWeek || 0,
      active_subcontracts: activeSubcontracts || 0,
      active_projects: projects || 0
    },
    insurance: {
      policies_expiring_60d: policiesExpiringSoon || 0,
      coi_expiring_30d: coiExpiringSoon || 0
    },
    ltr: {
      active_leases: activeLeases || 0
    },
    portfolio: {
      properties: properties || 0,
      entities: entities || 0
    },
    alerts: {
      upcoming_reminders: upcomingReminders || 0
    }
  });
}
