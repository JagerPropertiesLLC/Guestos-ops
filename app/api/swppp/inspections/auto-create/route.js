// app/api/swppp/inspections/auto-create/route.js
//
// Called by Railway when the user replies to the inspection SMS.
//
// Request body (POST JSON):
// {
//   "swppp_project_id": "uuid",
//   "sms_id": "uuid",                  // ID of the swppp_inspection_sms record
//   "reply_state": "NONE" | "CHANGES",
//   "reply_changes": [                 // optional, only if reply_state === "CHANGES"
//     { "type": "bmp" | "site_check" | "discharge" | "non_compliance",
//       "ref": "T.W." | 3 | "since_last" | "now" | null,
//       "description": "free text",
//       "needs_maintenance": true|false }
//   ],
//   "weather_event_id": "uuid"|null,   // if this is a post-storm
//   "shared_secret": "string"          // matches RAILWAY_SHARED_SECRET env
// }
//
// Behavior:
//   - Pulls swppp_projects defaults (inspector name/title/contact/quals, signature URL)
//   - Pulls weather snapshot from sms record
//   - Sets inspection_type = "post_storm" if weather_event_id provided, else "regular"
//   - Sets BMPs to last week's state (default Installed=Yes/Maint=No)
//   - Sets site checks to last week's state (default Yes/Maint=No, N/A for non-applicable)
//   - Applies any reply_changes
//   - Sets start_time = sms reply_received_at
//   - Sets end_time = reply_received_at + random(10-20) min
//   - Certifies with default_inspector_name + saved signature
//   - Creates the inspection record + bmp_findings + site_check_findings
//   - Marks the SMS record as 'submitted' and links the inspection_id
//
// Returns: { inspection_id: "uuid", reused_signature: bool }

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export async function POST(request) {
  try {
    const body = await request.json();
    const sharedSecret = process.env.RAILWAY_SHARED_SECRET;
    if (sharedSecret && body.shared_secret !== sharedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { swppp_project_id, sms_id, reply_state, reply_changes = [], weather_event_id } = body;
    if (!swppp_project_id || !reply_state) {
      return NextResponse.json({ error: 'swppp_project_id and reply_state are required' }, { status: 400 });
    }

    const supa = getSupabaseAdmin();

    // 1. Load the SWPPP project (defaults, weather coords, signature)
    const { data: swppp, error: swpppErr } = await supa
      .from('swppp_projects')
      .select(`
        id, project_id,
        default_inspector_name, default_inspector_title, default_inspector_contact,
        default_inspector_qualifications, default_construction_phase,
        signature_image_url, rain_threshold_inches
      `)
      .eq('id', swppp_project_id)
      .single();
    if (swpppErr) return NextResponse.json({ error: swpppErr.message }, { status: 404 });

    // 2. Load the SMS record (for timestamps + weather snapshot)
    let smsRecord = null;
    if (sms_id) {
      const { data } = await supa
        .from('swppp_inspection_sms')
        .select('*')
        .eq('id', sms_id)
        .single();
      smsRecord = data;
    }

    // 3. Load active BMPs and site checks
    const [
      { data: bmps = [] },
      { data: siteChecks = [] },
      { data: lastBmpFindings = [] },
      { data: lastSiteFindings = [] }
    ] = await Promise.all([
      supa.from('swppp_bmps').select('*').eq('swppp_project_id', swppp_project_id).eq('active', true).order('bmp_number'),
      supa.from('swppp_site_checks').select('*').eq('swppp_project_id', swppp_project_id).order('check_number'),
      // last week's findings (most recent inspection's BMP findings)
      supa.from('swppp_bmp_findings')
        .select('bmp_id, installed, maintenance_required, notes, inspection:swppp_inspections!inspection_id(swppp_project_id, inspection_date)')
        .order('inspection(inspection_date)', { ascending: false })
        .limit(50),
      supa.from('swppp_site_check_findings')
        .select('site_check_id, passing, maintenance_required, notes, inspection:swppp_inspections!inspection_id(swppp_project_id, inspection_date)')
        .order('inspection(inspection_date)', { ascending: false })
        .limit(50)
    ]);

    // Build lookup maps for the most recent finding per BMP / per site_check (filtered to this project)
    const lastBmpByBmpId = {};
    for (const f of lastBmpFindings) {
      if (f.inspection?.swppp_project_id === swppp_project_id && !lastBmpByBmpId[f.bmp_id]) {
        lastBmpByBmpId[f.bmp_id] = f;
      }
    }
    const lastSiteByCheckId = {};
    for (const f of lastSiteFindings) {
      if (f.inspection?.swppp_project_id === swppp_project_id && !lastSiteByCheckId[f.site_check_id]) {
        lastSiteByCheckId[f.site_check_id] = f;
      }
    }

    // 4. Compute timestamps
    const now = new Date();
    const replyTime = smsRecord?.reply_received_at ? new Date(smsRecord.reply_received_at) : now;
    const endOffsetMin = 10 + Math.floor(Math.random() * 11); // 10-20 min
    const endTime = new Date(replyTime.getTime() + endOffsetMin * 60 * 1000);

    const fmtTime = (d) => d.toTimeString().slice(0, 5); // HH:MM
    const today = replyTime.toISOString().slice(0, 10);

    // 5. Build the inspection insert
    const isPostStorm = !!weather_event_id;
    const weatherSnapshot = smsRecord?.weather_snapshot || {};
    const wxConditions = parseWeatherConditions(weatherSnapshot);

    // Process reply_changes to build override maps
    const bmpOverrides = {};   // bmp_code or bmp_number -> { installed, maintenance_required, notes }
    const siteOverrides = {};   // check_number -> { passing, maintenance_required, notes }
    const changeNotes = [];     // free-text changes that don't map to specific items
    let dischargeSinceLast = false;
    let dischargeSinceLastDesc = '';
    let dischargeNow = false;
    let dischargeNowDesc = '';
    let nonCompliance = '';

    for (const change of reply_changes) {
      if (change.type === 'bmp') {
        bmpOverrides[String(change.ref).toUpperCase()] = {
          installed: change.installed !== false,  // default true unless explicitly false
          maintenance_required: change.needs_maintenance === true,
          notes: change.description || ''
        };
      } else if (change.type === 'site_check') {
        siteOverrides[change.ref] = {
          passing: change.passing !== false,
          maintenance_required: change.needs_maintenance === true,
          notes: change.description || ''
        };
      } else if (change.type === 'discharge') {
        if (change.ref === 'since_last') {
          dischargeSinceLast = true;
          dischargeSinceLastDesc = change.description || '';
        } else if (change.ref === 'now') {
          dischargeNow = true;
          dischargeNowDesc = change.description || '';
        }
      } else if (change.type === 'non_compliance') {
        nonCompliance = change.description || '';
      } else {
        changeNotes.push(change.description || '');
      }
    }

    // Build the inspection record
    const insertData = {
      swppp_project_id,
      inspection_type: isPostStorm ? 'post_storm' : 'regular',
      inspection_date: today,
      start_time: fmtTime(replyTime),
      end_time: fmtTime(endTime),
      inspector_name: swppp.default_inspector_name || 'Judson J Vandertoll',
      inspector_title: swppp.default_inspector_title || 'General Contractor',
      inspector_contact: swppp.default_inspector_contact || '303-332-7971',
      inspector_qualifications: swppp.default_inspector_qualifications || 'Licensed Commercial General Contractor',
      construction_phase_description: swppp.default_construction_phase || 'Building Phase',
      storm_event_id: weather_event_id || null,
      storm_since_last_inspection: isPostStorm,
      storm_start_at: weatherSnapshot.storm_start_at || null,
      storm_duration_hours: weatherSnapshot.storm_duration_hours || null,
      storm_precipitation_inches: weatherSnapshot.storm_precipitation_inches || null,
      weather_clear: wxConditions.clear,
      weather_cloudy: wxConditions.cloudy,
      weather_rain: wxConditions.rain,
      weather_sleet: wxConditions.sleet,
      weather_fog: wxConditions.fog,
      weather_snowing: wxConditions.snowing,
      weather_high_winds: wxConditions.high_winds,
      weather_other: null,
      weather_temp_f: weatherSnapshot.temp_f != null ? Math.round(weatherSnapshot.temp_f) : null,
      discharges_since_last: dischargeSinceLast,
      discharges_since_last_description: dischargeSinceLast ? dischargeSinceLastDesc : null,
      discharges_now: dischargeNow,
      discharges_now_description: dischargeNow ? dischargeNowDesc : null,
      non_compliance_notes: nonCompliance || (changeNotes.length > 0 ? changeNotes.join(' | ') : null),
      status: 'certified',
      certified_at: replyTime.toISOString(),
      certified_by_name: swppp.default_inspector_name,
      certified_by_title: swppp.default_inspector_title,
      signature_data: 'auto_certified_via_sms_reply'
    };

    const { data: inspection, error: insErr } = await supa
      .from('swppp_inspections')
      .insert(insertData)
      .select()
      .single();
    if (insErr) {
      console.error('[auto-create] insert failed:', insErr);
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    // 6. Insert BMP findings (one per active BMP)
    const bmpFindingRows = bmps.map(bmp => {
      const override = bmpOverrides[bmp.bmp_code?.toUpperCase()] || bmpOverrides[String(bmp.bmp_number)];
      const last = lastBmpByBmpId[bmp.id];
      return {
        inspection_id: inspection.id,
        bmp_id: bmp.id,
        installed: override ? override.installed : (last?.installed ?? true),
        maintenance_required: override ? override.maintenance_required : (last?.maintenance_required ?? false),
        notes: override?.notes || null
      };
    });
    if (bmpFindingRows.length > 0) {
      await supa.from('swppp_bmp_findings').insert(bmpFindingRows);
    }

    // 7. Insert site check findings (one per check)
    const siteCheckFindingRows = siteChecks.map(sc => {
      const override = siteOverrides[sc.check_number];
      const last = lastSiteByCheckId[sc.id];
      const isApplicable = sc.applicable !== false;
      return {
        inspection_id: inspection.id,
        site_check_id: sc.id,
        passing: !isApplicable ? null : (override ? override.passing : (last?.passing ?? true)),
        maintenance_required: !isApplicable ? null : (override ? override.maintenance_required : (last?.maintenance_required ?? false)),
        notes: override?.notes || null
      };
    });
    if (siteCheckFindingRows.length > 0) {
      await supa.from('swppp_site_check_findings').insert(siteCheckFindingRows);
    }

    // 8. Insert corrective actions for any BMP / site check now flagged for maintenance
    const correctiveActionRows = [];
    for (const f of bmpFindingRows) {
      if (f.maintenance_required) {
        correctiveActionRows.push({
          inspection_id: inspection.id,
          bmp_id: f.bmp_id,
          description: f.notes || 'Maintenance required (reported via SMS)',
          identified_date: today,
          status: 'open'
        });
      }
    }
    for (const f of siteCheckFindingRows) {
      if (f.maintenance_required || f.passing === false) {
        correctiveActionRows.push({
          inspection_id: inspection.id,
          description: f.notes || 'Site issue reported via SMS',
          identified_date: today,
          status: 'open'
        });
      }
    }
    if (correctiveActionRows.length > 0) {
      await supa.from('swppp_corrective_actions').insert(correctiveActionRows);
    }

    // 9. Mark the storm event as inspected, if applicable
    if (weather_event_id) {
      await supa.from('swppp_weather_events').update({
        inspection_completed_id: inspection.id,
        inspection_satisfied: true
      }).eq('id', weather_event_id);
    }

    // 10. Mark the SMS record as submitted and linked
    if (sms_id) {
      await supa.from('swppp_inspection_sms').update({
        inspection_id: inspection.id,
        status: 'submitted',
        reply_parsed_state: reply_state,
        reply_parsed_changes: reply_changes
      }).eq('id', sms_id);
    }

    return NextResponse.json({
      inspection_id: inspection.id,
      reused_signature: !!swppp.signature_image_url,
      summary: {
        type: insertData.inspection_type,
        bmps_logged: bmpFindingRows.length,
        site_checks_logged: siteCheckFindingRows.length,
        corrective_actions_opened: correctiveActionRows.length
      }
    });
  } catch (e) {
    console.error('[auto-create]', e);
    return NextResponse.json({ error: 'Auto-create failed', detail: e.message }, { status: 500 });
  }
}

function parseWeatherConditions(snapshot) {
  // Snapshot looks like { description: "clear sky" | "broken clouds" | "light rain" | ..., temp_f, ... }
  const desc = (snapshot.description || '').toLowerCase();
  return {
    clear: /clear|sunny/.test(desc) || (!desc),  // default to clear if unknown
    cloudy: /cloud|overcast/.test(desc),
    rain: /rain|drizzle|shower/.test(desc),
    sleet: /sleet/.test(desc),
    fog: /fog|mist|haze/.test(desc),
    snowing: /snow/.test(desc),
    high_winds: /wind/.test(desc) && (snapshot.wind_mph || 0) > 20
  };
}

export const dynamic = 'force-dynamic';
