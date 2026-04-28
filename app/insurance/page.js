// app/insurance/page.js
'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, XCircle, MinusCircle, Mail } from 'lucide-react';

export default function InsurancePage() {
  const [tab, setTab] = useState('grid');
  const [data, setData] = useState({ property_rows: [], coi_rows: [], coverage_types: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch('/api/insurance-grid').then(r => r.json()).then(d => {
      setData(d);
      setLoading(false);
    });
  }, []);

  return (
    <div style={{ maxWidth: 1300, margin: '0 auto', padding: '24px 28px' }}>
      <h1 style={{ margin: 0, fontSize: 26 }}>Insurance & COIs</h1>
      <p style={{ marginTop: 4, color: '#64748b' }}>
        Traffic-light view of every policy and COI. Green ≥ 60d, blue 30-60d, yellow ≤ 30d, red ≤ 14d, dark red expired.
      </p>

      <div style={{ display: 'flex', gap: 16, borderBottom: '1px solid #e2e8f0', marginTop: 20, marginBottom: 24 }}>
        <Tab active={tab === 'grid'} onClick={() => setTab('grid')}>Grid View</Tab>
        <Tab active={tab === 'cois'} onClick={() => setTab('cois')}>Vendor COIs ({data.coi_rows.length})</Tab>
      </div>

      <Legend />

      {loading && <p style={{ marginTop: 20 }}>Loading…</p>}

      {!loading && tab === 'grid' && <PropertyGrid rows={data.property_rows} coverageTypes={data.coverage_types} />}
      {!loading && tab === 'cois'  && <CoiTable rows={data.coi_rows} />}
    </div>
  );
}

function Tab({ children, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: 'transparent', border: 0, padding: '10px 4px', cursor: 'pointer',
      borderBottom: active ? '2px solid #0f172a' : '2px solid transparent',
      fontWeight: active ? 600 : 500, color: active ? '#0f172a' : '#64748b', fontSize: 14
    }}>{children}</button>
  );
}

function Legend() {
  return (
    <div style={{ display: 'flex', gap: 14, marginBottom: 16, fontSize: 12, color: '#64748b', flexWrap: 'wrap' }}>
      <LegendChip status="ok" label="Active (60+ days)" />
      <LegendChip status="soon" label="30-60 days" />
      <LegendChip status="warn" label="≤ 30 days" />
      <LegendChip status="critical" label="≤ 14 days" />
      <LegendChip status="expired" label="Expired" />
      <LegendChip status="missing" label="Missing" />
    </div>
  );
}

const STATUS_STYLES = {
  ok:       { bg: '#dcfce7', fg: '#15803d', Icon: CheckCircle2,  label: 'OK' },
  soon:     { bg: '#dbeafe', fg: '#1d4ed8', Icon: AlertCircle,   label: 'Soon' },
  warn:     { bg: '#fef3c7', fg: '#a16207', Icon: AlertTriangle, label: 'Warn' },
  critical: { bg: '#fee2e2', fg: '#b91c1c', Icon: AlertTriangle, label: 'Critical' },
  expired:  { bg: '#fecaca', fg: '#7f1d1d', Icon: XCircle,       label: 'Expired' },
  missing:  { bg: '#f1f5f9', fg: '#64748b', Icon: MinusCircle,   label: 'Missing' }
};

function LegendChip({ status, label }) {
  const s = STATUS_STYLES[status];
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: s.bg, color: s.fg, borderRadius: 999, fontWeight: 500 }}>
      <s.Icon size={12} /> {label}
    </span>
  );
}

function StatusCell({ cell }) {
  const s = STATUS_STYLES[cell.status];
  if (cell.status === 'missing') {
    return <div style={{ padding: '8px 6px', textAlign: 'center', color: s.fg, fontSize: 12 }}>—</div>;
  }
  const days = cell.expiration_date
    ? Math.floor((new Date(cell.expiration_date).getTime() - Date.now()) / 86400000)
    : null;
  return (
    <div style={{ padding: 8, background: s.bg, color: s.fg, borderRadius: 6, fontSize: 11, textAlign: 'center' }}>
      <div style={{ fontWeight: 600 }}>{days != null ? (days >= 0 ? `${days}d` : `${Math.abs(days)}d ago`) : '—'}</div>
      {cell.expiration_date && <div style={{ fontSize: 10, marginTop: 2, opacity: 0.85 }}>{cell.expiration_date}</div>}
    </div>
  );
}

function PropertyGrid({ rows, coverageTypes }) {
  if (rows.length === 0) {
    return <Empty msg="No properties yet." hint="Add a property to see its insurance status." />;
  }
  return (
    <div style={tableWrap}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...th, width: '22%' }}>Property</th>
            {coverageTypes.map(t => (
              <th key={t} style={{ ...th, textAlign: 'center', textTransform: 'capitalize' }}>{t.replace(/_/g, ' ')}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.property.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '12px', verticalAlign: 'top' }}>
                <div style={{ fontWeight: 500, fontSize: 14 }}>{r.property.short_name}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{r.property.full_address}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{r.property.entity?.name}</div>
              </td>
              {coverageTypes.map(t => (
                <td key={t} style={{ padding: 6 }}>
                  <StatusCell cell={r.cells[t]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CoiTable({ rows }) {
  async function requestRenewal(companyId) {
    const r = await fetch('/api/coi-renewal-request', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ company_id: companyId })
    });
    if (r.ok) {
      alert('Renewal request drafted. Approval flow not yet wired — view stub for now.');
    } else {
      alert(await r.text());
    }
  }

  if (rows.length === 0) {
    return <Empty msg="No vendors / subcontractors yet." hint="Add companies of type 'sub' or 'general_contractor' to track their COIs." />;
  }

  return (
    <div style={tableWrap}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>Company</th>
            <th style={th}>Type</th>
            <th style={th}>Market</th>
            <th style={{ ...th, textAlign: 'center' }}>COI Status</th>
            <th style={th}>GL Coverage</th>
            <th style={th}>WC Coverage</th>
            <th style={th}>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const s = STATUS_STYLES[r.coi.status];
            const days = r.coi.expiration_date
              ? Math.floor((new Date(r.coi.expiration_date).getTime() - Date.now()) / 86400000)
              : null;
            return (
              <tr key={r.company.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={td}><strong>{r.company.name}</strong></td>
                <td style={td}>{r.company.type}</td>
                <td style={td}>{r.company.market?.name || '—'}</td>
                <td style={{ padding: 8 }}>
                  <div style={{ padding: 8, background: s.bg, color: s.fg, borderRadius: 6, fontSize: 11, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <s.Icon size={12} />
                    {days != null ? (days >= 0 ? `${days}d (${r.coi.expiration_date})` : `Expired ${Math.abs(days)}d ago`) : 'Missing'}
                  </div>
                </td>
                <td style={td}>{r.coi.general_liability_amount ? `$${Number(r.coi.general_liability_amount).toLocaleString()}` : '—'}</td>
                <td style={td}>{r.coi.workers_comp_amount ? `$${Number(r.coi.workers_comp_amount).toLocaleString()}` : '—'}</td>
                <td style={td}>
                  {(r.coi.status === 'warn' || r.coi.status === 'critical' || r.coi.status === 'expired' || r.coi.status === 'missing') ? (
                    <button onClick={() => requestRenewal(r.company.id)} style={btnSmall}>
                      <Mail size={12} /> Request renewal
                    </button>
                  ) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Empty({ msg, hint }) {
  return (
    <div style={{ padding: 40, textAlign: 'center', background: '#fff', border: '1px dashed #cbd5e1', borderRadius: 10 }}>
      <div style={{ fontSize: 16, color: '#0f172a', fontWeight: 500 }}>{msg}</div>
      <div style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>{hint}</div>
    </div>
  );
}

const tableWrap = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' };
const th = { padding: '10px 12px', textAlign: 'left', fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #e2e8f0', fontWeight: 600 };
const td = { padding: '12px', borderBottom: '1px solid #f1f5f9', fontSize: 14, verticalAlign: 'middle' };
const btnSmall = { background: '#0f172a', color: '#fff', border: 0, padding: '6px 10px', borderRadius: 5, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 };
