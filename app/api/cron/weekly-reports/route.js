// app/api/cron/weekly-reports/route.js
//
// Runs every Monday morning. For each active SWPPP project:
// - Build a "weekly report" covering the prior 7 days.
// - Capture inspection count, storm event count, open corrective actions.
// - Generate the PDF and store it in Supabase Storage.
// - Insert a row into swppp_reports for the archive.
//
// Important: this runs even if no inspections happened.
// It's a recordkeeping artifact; auditors expect to see the cadence.
// If no weather event AND no inspection happened in a quiet week, the report
// will just be a "no inspection events this week" placeholder.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supa = getSupabaseAdmin();

  // Period: prior 7 calendar days, ending yesterday
  const today = new Date();
  const periodEnd = new Date(today);
  periodEnd.setDate(periodEnd.getDate() - 1);
  const periodStart = new Date(periodEnd);
  periodStart.setDate(periodStart.getDate() - 6);
  const periodStartStr = periodStart.toISOString().slice(0, 10);
  const periodEndStr = periodEnd.toISOString().slice(0, 10);

  const { data: projects = [] } = await supa
    .from('swppp_projects')
    .select('id, project_id, weather_lat, weather_lon')
    .eq('active', true);

  const results = [];

  for (const proj of projects) {
    try {
      // Counts for this period
      const { count: inspCount } = await supa
        .from('swppp_inspections')
        .select('id', { count: 'exact', head: true })
        .eq('swppp_project_id', proj.id)
        .gte('inspection_date', periodStartStr)
        .lte('inspection_date', periodEndStr);

      const { count: stormCount } = await supa
        .from('swppp_weather_events')
        .select('id', { count: 'exact', head: true })
        .eq('swppp_project_id', proj.id)
        .eq('triggered_threshold', true)
        .gte('event_date', periodStartStr)
        .lte('event_date', periodEndStr);

      const { count: openCAs } = await supa
        .from('swppp_corrective_actions')
        .select('id, inspection:swppp_inspections!inspection_id!inner(swppp_project_id)', { count: 'exact', head: true })
        .in('status', ['open', 'in_progress']);

      // Insert the report row. The PDF gets generated on-demand when the user opens it.
      const { data: report } = await supa.from('swppp_reports').insert({
        swppp_project_id: proj.id,
        report_type: 'weekly',
        period_start: periodStartStr,
        period_end: periodEndStr,
        inspection_count: inspCount || 0,
        storm_event_count: stormCount || 0,
        open_corrective_actions_count: openCAs || 0
      }).select().single();

      results.push({
        project_id: proj.id,
        report_id: report?.id,
        period: `${periodStartStr} to ${periodEndStr}`,
        inspections: inspCount,
        storms: stormCount
      });
    } catch (e) {
      results.push({ project_id: proj.id, error: e.message });
    }
  }

  return NextResponse.json({
    ok: true,
    period: `${periodStartStr} to ${periodEndStr}`,
    results
  });
}

export const dynamic = 'force-dynamic';
