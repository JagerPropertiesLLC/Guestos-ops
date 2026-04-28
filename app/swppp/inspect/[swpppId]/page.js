// app/swppp/inspect/[swpppId]/page.js
'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, Save, Send } from 'lucide-react';

export default function NewInspection() {
  const { swpppId } = useParams();
  const search = useSearchParams();
  const router = useRouter();
  const stormEventId = search.get('storm');

  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/swppp/projects/${swpppId}`).then(r => r.json()).then(d => {
      setData(d);
      const today = new Date().toISOString().slice(0, 10);
      setForm({
        inspection_type: stormEventId ? 'post_storm' : 'regular',
        inspection_date: today,
        start_time: '',
        end_time: '',
        inspector_name: '',
        inspector_title: '',
        inspector_contact: '',
        inspector_qualifications: '',
        construction_phase_description: '',
        storm_event_id: stormEventId || null,
        storm_since_last_inspection: !!stormEventId,
        storm_start_at: '',
        storm_duration_hours: '',
        storm_precipitation_inches: '',
        weather_clear: false,
        weather_cloudy: false,
        weather_rain: false,
        weather_sleet: false,
        weather_fog: false,
        weather_snowing: false,
        weather_high_winds: false,
        weather_other: '',
        weather_temp_f: '',
        discharges_since_last: false,
        discharges_since_last_description: '',
        discharges_now: false,
        discharges_now_description: '',
        non_compliance_notes: '',
        bmp_findings: (d.bmps || []).map(b => ({ bmp_id: b.id, bmp: b, installed: null, maintenance_required: null, notes: '' })),
        site_check_findings: (d.site_checks || []).map(s => ({ site_check_id: s.id, site_check: s, passing: null, maintenance_required: null, notes: '' })),
        corrective_actions: [],
        certify_now: false,
        certified_by_name: '',
        certified_by_title: '',
        signature_data: ''
      });
    });
  }, [swpppId, stormEventId]);

  async function submit(certify) {
    if (!form.inspector_name) { alert('Inspector name is required'); return; }
    setSubmitting(true);
    const payload = {
      ...form,
      swppp_project_id: swpppId,
      certify_now: certify
    };
    const r = await fetch('/api/swppp/inspections', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    setSubmitting(false);
    if (r.ok) {
      const j = await r.json();
      // Go back to project tab
      router.push(`/construction/${data.swppp.project_id}?tab=swppp&new=${j.inspection.id}`);
    } else {
      const err = await r.text();
      alert('Save failed: ' + err);
    }
  }

  if (!form || !data) return <div style={{ padding: 24 }}>Loading…</div>;

  const set = (k) => (v) => setForm({ ...form, [k]: v });
  const toggle = (k) => () => setForm({ ...form, [k]: !form[k] });

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '20px 16px', paddingBottom: 80 }}>
      <h1 style={{ fontSize: 22, marginTop: 0 }}>SWPPP Inspection</h1>
      <p style={{ marginTop: 4, color: '#64748b', fontSize: 13 }}>{data.swppp?.project?.name || 'Project'}</p>

      {/* Type of Inspection */}
      <Section title="Type of Inspection">
        <SegmentedControl
          options={[
            { value: 'regular', label: 'Regular' },
            { value: 'pre_storm', label: 'Pre-storm' },
            { value: 'during_storm', label: 'During storm' },
            { value: 'post_storm', label: 'Post-storm' }
          ]}
          value={form.inspection_type}
          onChange={set('inspection_type')}
        />
      </Section>

      <Section title="General Information">
        <Field label="Date *">
          <input type="date" value={form.inspection_date} onChange={(e) => set('inspection_date')(e.target.value)} style={input} />
        </Field>
        <TwoCol>
          <Field label="Start time">
            <input type="time" value={form.start_time} onChange={(e) => set('start_time')(e.target.value)} style={input} />
          </Field>
          <Field label="End time">
            <input type="time" value={form.end_time} onChange={(e) => set('end_time')(e.target.value)} style={input} />
          </Field>
        </TwoCol>
        <Field label="Inspector name *">
          <input value={form.inspector_name} onChange={(e) => set('inspector_name')(e.target.value)} style={input} />
        </Field>
        <Field label="Inspector title">
          <input value={form.inspector_title} onChange={(e) => set('inspector_title')(e.target.value)} style={input} />
        </Field>
        <Field label="Inspector contact (phone or email)">
          <input value={form.inspector_contact} onChange={(e) => set('inspector_contact')(e.target.value)} style={input} />
        </Field>
        <Field label="Present phase of construction">
          <input value={form.construction_phase_description} onChange={(e) => set('construction_phase_description')(e.target.value)} style={input} placeholder="Earthwork, framing, exterior, etc." />
        </Field>
      </Section>

      <Section title="Weather">
        <Toggle label="Storm event since last inspection?" value={form.storm_since_last_inspection} onChange={toggle('storm_since_last_inspection')} />
        {form.storm_since_last_inspection && (
          <>
            <Field label="Storm start (date + time)">
              <input type="datetime-local" value={form.storm_start_at} onChange={(e) => set('storm_start_at')(e.target.value)} style={input} />
            </Field>
            <TwoCol>
              <Field label="Duration (hrs)">
                <input type="number" step="0.5" value={form.storm_duration_hours} onChange={(e) => set('storm_duration_hours')(e.target.value)} style={input} />
              </Field>
              <Field label="Precipitation (in)">
                <input type="number" step="0.01" value={form.storm_precipitation_inches} onChange={(e) => set('storm_precipitation_inches')(e.target.value)} style={input} />
              </Field>
            </TwoCol>
          </>
        )}

        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, color: '#475569', fontWeight: 500, marginBottom: 6 }}>Current weather (check all that apply)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {['clear','cloudy','rain','sleet','fog','snowing','high_winds'].map(k => (
              <Chip key={k} active={form[`weather_${k}`]} onClick={toggle(`weather_${k}`)}>
                {k.replace('_', ' ')}
              </Chip>
            ))}
          </div>
        </div>

        <Field label="Other weather notes">
          <input value={form.weather_other} onChange={(e) => set('weather_other')(e.target.value)} style={input} />
        </Field>
        <Field label="Temperature (°F)">
          <input type="number" inputMode="numeric" value={form.weather_temp_f} onChange={(e) => set('weather_temp_f')(e.target.value)} style={input} />
        </Field>
      </Section>

      <Section title="Discharges">
        <Toggle label="Any discharges since last inspection?" value={form.discharges_since_last} onChange={toggle('discharges_since_last')} />
        {form.discharges_since_last && (
          <Field label="Describe">
            <textarea value={form.discharges_since_last_description} onChange={(e) => set('discharges_since_last_description')(e.target.value)} style={{ ...input, minHeight: 60 }} />
          </Field>
        )}
        <Toggle label="Any discharges now?" value={form.discharges_now} onChange={toggle('discharges_now')} />
        {form.discharges_now && (
          <Field label="Describe">
            <textarea value={form.discharges_now_description} onChange={(e) => set('discharges_now_description')(e.target.value)} style={{ ...input, minHeight: 60 }} />
          </Field>
        )}
      </Section>

      <Section title="BMPs">
        {form.bmp_findings.map((f, idx) => (
          <BmpRow key={f.bmp_id} finding={f} onChange={(updated) => {
            const arr = [...form.bmp_findings]; arr[idx] = updated; set('bmp_findings')(arr);
          }} />
        ))}
      </Section>

      <Section title="Overall Site Issues">
        {form.site_check_findings.map((f, idx) => (
          <SiteCheckRow key={f.site_check_id} finding={f} onChange={(updated) => {
            const arr = [...form.site_check_findings]; arr[idx] = updated; set('site_check_findings')(arr);
          }} />
        ))}
      </Section>

      <Section title="Non-compliance">
        <Field label="Describe any incidents not described above">
          <textarea value={form.non_compliance_notes} onChange={(e) => set('non_compliance_notes')(e.target.value)} style={{ ...input, minHeight: 80 }} />
        </Field>
      </Section>

      <Section title="Certification">
        <p style={{ fontSize: 12, color: '#475569' }}>
          Required by 40 CFR 122.22. Click "Submit & Certify" to apply your certification when ready.
        </p>
        <Field label="Print name & title (defaults to inspector name)">
          <input value={form.certified_by_name} onChange={(e) => set('certified_by_name')(e.target.value)} placeholder={form.inspector_name} style={input} />
        </Field>
      </Section>

      {/* Sticky bottom action bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        padding: 12, background: '#fff', borderTop: '1px solid #e2e8f0',
        display: 'flex', gap: 8, justifyContent: 'flex-end', maxWidth: 700, margin: '0 auto'
      }}>
        <button onClick={() => submit(false)} disabled={submitting} style={btnSecondary}>
          <Save size={14} /> Save draft
        </button>
        <button onClick={() => submit(true)} disabled={submitting} style={btnPrimary}>
          <Send size={14} /> Submit & Certify
        </button>
      </div>
    </div>
  );
}

function BmpRow({ finding, onChange }) {
  const set = (k, v) => onChange({ ...finding, [k]: v });
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 8 }}>
      <div style={{ fontWeight: 600, fontSize: 14 }}>
        #{finding.bmp.bmp_number}{finding.bmp.bmp_code ? ` ${finding.bmp.bmp_code}` : ''} — {finding.bmp.bmp_name}
      </div>
      <div style={{ fontSize: 12, color: '#64748b' }}>{finding.bmp.location_description}</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <YesNo label="Installed?" value={finding.installed} onChange={(v) => set('installed', v)} />
        <YesNo label="Maint. needed?" value={finding.maintenance_required} onChange={(v) => set('maintenance_required', v)} />
      </div>
      {finding.maintenance_required && (
        <textarea
          placeholder="Notes / corrective action needed"
          value={finding.notes}
          onChange={(e) => set('notes', e.target.value)}
          style={{ ...input, marginTop: 8, minHeight: 50 }}
        />
      )}
    </div>
  );
}

function SiteCheckRow({ finding, onChange }) {
  const set = (k, v) => onChange({ ...finding, [k]: v });
  const isApplicable = finding.site_check.applicable !== false;
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 500 }}>{finding.site_check.check_question}</div>
      {!isApplicable ? (
        <div style={{ marginTop: 6, fontSize: 12, color: '#64748b', fontStyle: 'italic' }}>N/A on this site</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <YesNo label="OK?" value={finding.passing} onChange={(v) => set('passing', v)} />
            <YesNo label="Maint. needed?" value={finding.maintenance_required} onChange={(v) => set('maintenance_required', v)} />
          </div>
          {(finding.maintenance_required || finding.passing === false) && (
            <textarea
              placeholder="Notes"
              value={finding.notes}
              onChange={(e) => set('notes', e.target.value)}
              style={{ ...input, marginTop: 8, minHeight: 50 }}
            />
          )}
        </>
      )}
    </div>
  );
}

function YesNo({ label, value, onChange }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={() => onChange(true)} style={pillBtn(value === true, '#dcfce7', '#166534')}>Yes</button>
        <button onClick={() => onChange(false)} style={pillBtn(value === false, '#fee2e2', '#b91c1c')}>No</button>
      </div>
    </div>
  );
}

function pillBtn(active, activeBg, activeFg) {
  return {
    flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid ' + (active ? activeFg : '#d4d4d4'),
    background: active ? activeBg : '#fff',
    color: active ? activeFg : '#64748b',
    cursor: 'pointer', fontSize: 13, fontWeight: 500
  };
}

function Chip({ children, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 12px', borderRadius: 999, fontSize: 12,
      border: '1px solid ' + (active ? '#0f172a' : '#d4d4d4'),
      background: active ? '#0f172a' : '#fff',
      color: active ? '#fff' : '#475569',
      cursor: 'pointer', textTransform: 'capitalize'
    }}>{children}</button>
  );
}

function Toggle({ label, value, onChange }) {
  return (
    <button onClick={onChange} style={{
      width: '100%', padding: '10px 14px', textAlign: 'left',
      border: '1px solid ' + (value ? '#0f172a' : '#d4d4d4'),
      background: value ? '#f1f5f9' : '#fff',
      borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      fontSize: 14, marginBottom: 8
    }}>
      <span>{label}</span>
      <span style={{
        width: 36, height: 20, borderRadius: 10, padding: 2,
        background: value ? '#0f172a' : '#cbd5e1',
        position: 'relative', transition: 'all 0.15s'
      }}>
        <span style={{
          width: 16, height: 16, borderRadius: 8, background: '#fff',
          position: 'absolute', top: 2, left: value ? 18 : 2,
          transition: 'all 0.15s'
        }} />
      </span>
    </button>
  );
}

function SegmentedControl({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: 4, borderRadius: 8 }}>
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)} style={{
          flex: 1, padding: '8px 4px', borderRadius: 6, border: 0, fontSize: 12,
          background: value === o.value ? '#fff' : 'transparent',
          color: value === o.value ? '#0f172a' : '#64748b',
          fontWeight: value === o.value ? 600 : 400,
          cursor: 'pointer',
          boxShadow: value === o.value ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
        }}>{o.label}</button>
      ))}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginTop: 22 }}>
      <h2 style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.5, color: '#64748b', marginTop: 0, marginBottom: 10 }}>{title}</h2>
      {children}
    </div>
  );
}
function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 12, color: '#475569', fontWeight: 500, display: 'block', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}
function TwoCol({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>{children}</div>;
}

const input = { width: '100%', padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: 6, fontSize: 14, boxSizing: 'border-box', background: '#fff' };
const btnPrimary = { background: '#0f172a', color: '#fff', border: 0, padding: '10px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 };
const btnSecondary = { background: '#fff', color: '#0f172a', border: '1px solid #d4d4d4', padding: '10px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 };
