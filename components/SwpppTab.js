// components/SwpppTab.js
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Cloud, CloudRain, CheckCircle2, AlertTriangle, FileText, QrCode, Plus, Calendar, Wrench } from 'lucide-react';

export default function SwpppTab({ projectId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/swppp/projects?project_id=${projectId}`);
      const j = await r.json();
      if (!j.swppp) {
        setError('SWPPP not yet configured for this project. Contact admin to enable.');
        setLoading(false);
        return;
      }
      const d = await fetch(`/api/swppp/projects/${j.swppp.id}`).then(r => r.json());
      setData(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [projectId]);

  if (loading) return <div style={{ padding: 24 }}>Loading SWPPP data…</div>;
  if (error) return (
    <div style={{ padding: 24, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b' }}>
      {error}
    </div>
  );
  if (!data) return null;

  const { swppp, bmps, inspections, weather_events, reports, open_corrective_actions } = data;
  const pendingStormInspection = weather_events.find(e => e.inspection_required && !e.inspection_satisfied);

  return (
    <div>
      {pendingStormInspection && (
        <div style={alertBox}>
          <AlertTriangle size={18} color="#b91c1c" />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: '#b91c1c' }}>Post-storm inspection required</div>
            <div style={{ fontSize: 13, color: '#7f1d1d', marginTop: 2 }}>
              {pendingStormInspection.rolling_24h_inches}" of precipitation on {pendingStormInspection.event_date} crossed the {data.swppp.rain_threshold_inches}" threshold. Inspect within 24 hours.
            </div>
          </div>
          <Link
            href={`/swppp/inspect/${swppp.id}?storm=${pendingStormInspection.id}`}
            style={{ ...btnPrimary, background: '#b91c1c' }}>
            Start inspection
          </Link>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <Stat label="Schedule" value={swppp.inspection_schedule === '7_day' ? 'Weekly (7-day)' : '14-day + Storm'} />
        <Stat label="Rain Threshold" value={`${swppp.rain_threshold_inches}"`} />
        <Stat label="Active BMPs" value={bmps.length} />
        <Stat label="Open Corrective Actions" value={open_corrective_actions.length} tone={open_corrective_actions.length > 0 ? 'warn' : 'ok'} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <Link href={`/swppp/inspect/${swppp.id}`} style={btnPrimary}><Plus size={14} /> New inspection</Link>
        <Link href={`/swppp/qr/${swppp.id}`} style={btnSecondary}><QrCode size={14} /> Public QR code</Link>
      </div>

      {/* Recent inspections */}
      <Section title={`Recent inspections (${inspections.length})`}>
        {inspections.length === 0 ? (
          <Empty msg="No inspections yet." />
        ) : (
          <Card>
            {inspections.slice(0, 10).map(i => (
              <Row key={i.id}>
                <span style={{ width: 110 }}>{i.inspection_date}</span>
                <Pill tone={i.inspection_type === 'post_storm' ? 'warn' : 'info'}>
                  {i.inspection_type.replace('_', ' ')}
                </Pill>
                <span style={{ flex: 1 }}>{i.inspector_name}</span>
                <Pill tone={i.status === 'certified' ? 'ok' : 'neutral'}>{i.status}</Pill>
                <Link href={`/api/swppp/inspections/${i.id}/pdf`} target="_blank" style={miniLink}><FileText size={12} /> PDF</Link>
              </Row>
            ))}
          </Card>
        )}
      </Section>

      {/* Weather events */}
      <Section title="Weather events">
        {weather_events.length === 0 ? (
          <Empty msg="No weather events on record. The system checks every hour." />
        ) : (
          <Card>
            {weather_events.slice(0, 10).map(e => (
              <Row key={e.id}>
                <CloudRain size={14} color="#3b82f6" />
                <span style={{ width: 110 }}>{e.event_date}</span>
                <span>{e.rolling_24h_inches}" — {e.event_type}</span>
                <span style={{ flex: 1 }} />
                {e.inspection_satisfied ? (
                  <Pill tone="ok"><CheckCircle2 size={11} /> Inspected</Pill>
                ) : e.inspection_required ? (
                  <Pill tone="warn">Inspection due</Pill>
                ) : (
                  <Pill tone="neutral">Below threshold</Pill>
                )}
              </Row>
            ))}
          </Card>
        )}
      </Section>

      {/* BMPs */}
      <Section title={`Active BMPs (${bmps.length})`}>
        <Card>
          {bmps.map(b => (
            <Row key={b.id}>
              <span style={{ width: 30, fontWeight: 600, color: '#64748b' }}>#{b.bmp_number}</span>
              <span style={{ width: 60, fontWeight: 600 }}>{b.bmp_code || '—'}</span>
              <span style={{ flex: 1 }}>{b.bmp_name}</span>
              <Pill tone="neutral">{b.bmp_category.replace('_', ' ')}</Pill>
            </Row>
          ))}
        </Card>
      </Section>

      {/* Open corrective actions */}
      {open_corrective_actions.length > 0 && (
        <Section title="Open corrective actions">
          <Card>
            {open_corrective_actions.map(ca => (
              <Row key={ca.id}>
                <Wrench size={14} color="#92400e" />
                <span style={{ flex: 1 }}>{ca.description}</span>
                <span style={{ fontSize: 12, color: '#64748b' }}>Due: {ca.due_date || '—'}</span>
                <Pill tone={ca.status === 'in_progress' ? 'info' : 'warn'}>{ca.status.replace('_', ' ')}</Pill>
              </Row>
            ))}
          </Card>
        </Section>
      )}

      {/* Reports archive */}
      <Section title={`Weekly reports archive (${reports.length})`}>
        {reports.length === 0 ? (
          <Empty msg="No reports yet. The first weekly report compiles next Monday morning." />
        ) : (
          <Card>
            {reports.map(r => (
              <Row key={r.id}>
                <Calendar size={14} color="#64748b" />
                <span style={{ width: 230 }}>{r.period_start} → {r.period_end}</span>
                <span style={{ fontSize: 12 }}>{r.inspection_count} inspections, {r.storm_event_count} storms</span>
                <span style={{ flex: 1 }} />
                <Link href={`/api/swppp/reports/${r.id}/pdf`} target="_blank" style={miniLink}><FileText size={12} /> PDF</Link>
              </Row>
            ))}
          </Card>
        )}
      </Section>
    </div>
  );
}

const alertBox = {
  display: 'flex', gap: 12, alignItems: 'flex-start',
  padding: '14px 16px', background: '#fef2f2', border: '1px solid #fecaca',
  borderRadius: 8, marginBottom: 18
};
const btnPrimary = { background: '#0f172a', color: '#fff', border: 0, padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' };
const btnSecondary = { background: '#fff', color: '#0f172a', border: '1px solid #d4d4d4', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' };
const miniLink = { color: '#475569', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' };

function Stat({ label, value, tone = 'neutral' }) {
  const tones = {
    neutral: { bg: '#fff', border: '#e2e8f0', value: '#0f172a' },
    warn:    { bg: '#fffbeb', border: '#fde68a', value: '#92400e' },
    ok:      { bg: '#f0fdf4', border: '#bbf7d0', value: '#166534' }
  };
  const t = tones[tone];
  return (
    <div style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 8, padding: '12px 14px' }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: '#64748b' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: t.value, marginTop: 4 }}>{value}</div>
    </div>
  );
}
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 13, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.6 }}>{title}</h3>
      {children}
    </div>
  );
}
function Card({ children }) {
  return <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8 }}>{children}</div>;
}
function Row({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
      {children}
    </div>
  );
}
function Pill({ children, tone = 'neutral' }) {
  const tones = {
    neutral: { bg: '#f1f5f9', fg: '#475569' },
    info:    { bg: '#dbeafe', fg: '#1e40af' },
    ok:      { bg: '#dcfce7', fg: '#166534' },
    warn:    { bg: '#fef3c7', fg: '#92400e' }
  };
  const t = tones[tone];
  return <span style={{ background: t.bg, color: t.fg, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4 }}>{children}</span>;
}
function Empty({ msg }) {
  return <div style={{ padding: 24, textAlign: 'center', color: '#64748b', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 8 }}>{msg}</div>;
}
