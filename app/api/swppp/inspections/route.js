// app/api/swppp/inspections/route.js
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export async function POST(request) {
  const supa = getSupabaseAdmin();
  const body = await request.json();
  if (body.start_time === '') body.start_time = null;
    if (body.end_time === '') body.end_time = null;
  const {
    swppp_project_id, inspection_type, inspection_date, start_time, end_time,
    inspector_name, inspector_title, inspector_contact, inspector_qualifications,
    construction_phase_description,
    storm_event_id, storm_since_last_inspection, storm_start_at, storm_duration_hours, storm_precipitation_inches,
    weather_clear, weather_cloudy, weather_rain, weather_sleet, weather_fog, weather_snowing, weather_high_winds, weather_other, weather_temp_f,
    discharges_since_last, discharges_since_last_description, discharges_now, discharges_now_description,
    bmp_findings, site_check_findings, corrective_actions, non_compliance_notes,
    certify_now, certified_by_name, certified_by_title, signature_data
  } = body;

  if (!swppp_project_id || !inspection_type || !inspection_date || !inspector_name) {
    return NextResponse.json({ error: 'swppp_project_id, inspection_type, inspection_date, and inspector_name are required' }, { status: 400 });
  }

  // Insert the inspection itself
  const insertData = {
    swppp_project_id, inspection_type, inspection_date, start_time, end_time,
    inspector_name, inspector_title, inspector_contact, inspector_qualifications,
    construction_phase_description,
    storm_event_id: storm_event_id || null,
    storm_since_last_inspection: !!storm_since_last_inspection,
    storm_start_at: storm_start_at || null,
    storm_duration_hours: storm_duration_hours || null,
    storm_precipitation_inches: storm_precipitation_inches || null,
    weather_clear: !!weather_clear, weather_cloudy: !!weather_cloudy, weather_rain: !!weather_rain,
    weather_sleet: !!weather_sleet, weather_fog: !!weather_fog, weather_snowing: !!weather_snowing,
    weather_high_winds: !!weather_high_winds, weather_other,
    weather_temp_f: weather_temp_f ? parseInt(weather_temp_f, 10) : null,
    discharges_since_last: !!discharges_since_last,
    discharges_since_last_description: discharges_since_last ? discharges_since_last_description : null,
    discharges_now: !!discharges_now,
    discharges_now_description: discharges_now ? discharges_now_description : null,
    non_compliance_notes,
    status: certify_now ? 'certified' : 'submitted'
  };
  if (certify_now) {
    insertData.certified_at = new Date().toISOString();
    insertData.certified_by_name = certified_by_name || inspector_name;
    insertData.certified_by_title = certified_by_title;
    insertData.signature_data = signature_data;
  }

  const { data: inspection, error: insErr } = await supa
    .from('swppp_inspections')
    .insert(insertData).select().single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  // Insert BMP findings
  if (Array.isArray(bmp_findings) && bmp_findings.length > 0) {
    const rows = bmp_findings.map(f => ({
      inspection_id: inspection.id,
      bmp_id: f.bmp_id,
      installed: f.installed,
      maintenance_required: f.maintenance_required,
      notes: f.notes || null
    }));
    await supa.from('swppp_bmp_findings').insert(rows);
  }

  // Insert site check findings
  if (Array.isArray(site_check_findings) && site_check_findings.length > 0) {
    const rows = site_check_findings.map(f => ({
      inspection_id: inspection.id,
      site_check_id: f.site_check_id,
      passing: f.passing,
      maintenance_required: f.maintenance_required,
      notes: f.notes || null
    }));
    await supa.from('swppp_site_check_findings').insert(rows);
  }

  // Insert corrective actions
  if (Array.isArray(corrective_actions) && corrective_actions.length > 0) {
    const rows = corrective_actions.map(ca => ({
      inspection_id: inspection.id,
      bmp_id: ca.bmp_id || null,
      description: ca.description,
      identified_date: ca.identified_date || inspection_date,
      due_date: ca.due_date || null,
      responsible_person: ca.responsible_person || null,
      status: 'open'
    }));
    await supa.from('swppp_corrective_actions').insert(rows);
  }

  // If this inspection was tied to a storm event, mark it satisfied
  if (storm_event_id) {
    await supa.from('swppp_weather_events').update({
      inspection_completed_id: inspection.id,
      inspection_satisfied: true
    }).eq('id', storm_event_id);
  }

  return NextResponse.json({ inspection });
}

export const dynamic = 'force-dynamic';
