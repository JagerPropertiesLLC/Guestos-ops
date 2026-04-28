// app/api/cron/weather-check/route.js
//
// Hourly cron triggered by Vercel.
// For each active SWPPP project: pull the current weather reading,
// log it as a 1-hour sample, compute the rolling 24h total, and if
// that total crosses the project's rain_threshold, create a weather
// event flagging that an inspection is required within 24 hours.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { fetchCurrentReading } from '@/lib/weather';

export async function GET(request) {
  // Vercel adds an Authorization header for cron requests in the form `Bearer <CRON_SECRET>`.
  // If you set CRON_SECRET in env, requests without it are rejected.
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supa = getSupabaseAdmin();
  const startedAt = Date.now();

  // Pull active SWPPP projects with weather coords
  const { data: projects = [] } = await supa
    .from('swppp_projects')
    .select('id, weather_lat, weather_lon, rain_threshold_inches, project_id')
    .eq('active', true)
    .not('weather_lat', 'is', null);

  const results = [];

  for (const proj of projects) {
    try {
      // 1. Fetch current reading
      const reading = await fetchCurrentReading({
        lat: proj.weather_lat,
        lon: proj.weather_lon
      });

      // 2. Log it
      const readingAt = new Date().toISOString();
      await supa.from('swppp_weather_readings').insert({
        swppp_project_id: proj.id,
        reading_at: readingAt,
        rain_1h_mm: reading.rain_1h_mm,
        snow_1h_mm: reading.snow_1h_mm,
        total_1h_in: reading.total_1h_in,
        temp_f: reading.temp_f ? Math.round(reading.temp_f) : null,
        description: reading.description,
        raw: reading.raw
      });

      // 3. Compute rolling 24h total from our own log (last 24 hourly readings)
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { data: last24 = [] } = await supa
        .from('swppp_weather_readings')
        .select('total_1h_in')
        .eq('swppp_project_id', proj.id)
        .gte('reading_at', since);
      const rolling24 = last24.reduce((s, r) => s + Number(r.total_1h_in || 0), 0);
      const rolling24Round = +rolling24.toFixed(2);

      // 4. Has it crossed the threshold? Create one weather event per crossing.
      // Avoid duplicates: only fire if there's no recent event already covering this period.
      const threshold = Number(proj.rain_threshold_inches || 0.25);
      let triggered = false;
      let eventId = null;

      if (rolling24Round >= threshold) {
        // Check if there's already an open event in the last 24 hours
        const { data: recentEvents = [] } = await supa
          .from('swppp_weather_events')
          .select('id, inspection_satisfied')
          .eq('swppp_project_id', proj.id)
          .gte('event_date', new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10))
          .eq('inspection_satisfied', false);

        if (recentEvents.length === 0) {
          // Create a new event
          const inspectionDueBy = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
          const { data: ev } = await supa.from('swppp_weather_events').insert({
            swppp_project_id: proj.id,
            event_type: reading.snow_1h_mm > reading.rain_1h_mm ? 'snow' : 'rain',
            event_date: new Date().toISOString().slice(0, 10),
            rolling_24h_inches: rolling24Round,
            triggered_threshold: true,
            inspection_required: true,
            inspection_due_by: inspectionDueBy,
            raw_data: { current_reading: reading, threshold_inches: threshold }
          }).select().single();
          triggered = true;
          eventId = ev?.id;
        }
      }

      results.push({
        project_id: proj.id,
        rolling_24h_inches: rolling24Round,
        threshold,
        triggered_new_event: triggered,
        event_id: eventId
      });
    } catch (e) {
      results.push({
        project_id: proj.id,
        error: e.message
      });
    }
  }

  return NextResponse.json({
    ok: true,
    elapsed_ms: Date.now() - startedAt,
    projects_checked: projects.length,
    results
  });
}

export const dynamic = 'force-dynamic';
