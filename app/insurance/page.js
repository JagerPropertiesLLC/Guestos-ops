// app/insurance/page.js
'use client';

import { useEffect, useState } from 'react';

export default function InsurancePage() {
  const [tab, setTab] = useState('policies');
  const [data, setData] = useState({ policies: [], cois: [] });
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const r = await fetch('/api/insurance');
    setData(await r.json());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 28px' }}>
      <h1 style={{ margin: 0, fontSize: 26 }}>Insurance & COIs</h1>
      <p style={{ marginTop: 4, color: '#64748b' }}>
        All your insurance policies and vendor COIs across the portfolio. Sorted by expiration.
      </p>

      <div style={{ display: 'flex', gap: 16, borderBottom: '1px solid #e2e8f0', marginTop: 20, marginBottom: 20 }}>
        <Tab active={tab === 'policies'} onClick={() => setTab('policies')}>
          Your Policies ({data.policies.length})
        </Tab>
        <Tab active={tab === 'coi'} onClick={() => setTab('coi')}>
          Vendor COIs ({data.cois.length})
        </Tab>
      </div>

      {loading && <p>Loading…</p>}

      {!loading && tab === 'policies' && (
        data.policies.length === 0 ? <Empty
          msg="No policies on file yet."
          hint="Add your first policy by uploading docs or entering manually. Reminders fire 60/30/14/7/1 days before expiration." />
        : <PoliciesTable rows={data.policies} />
      )}

      {!loading && tab === 'coi' && (
        data.cois.length === 0 ? <Empty
          msg="No vendor COIs on file yet."
          hint="When you add subs / vendors with COI records, they'll appear here. Auto-renewal email goes out 30 days before expiration." />
        : <CoisTable rows={data.cois} onRequestRenewal={async (id) => alert('Auto-renewal request will be wired to the COI Renewal automation. Stub for now.')} />
      )}
    </div>
  );
}

function Tab({ active, children, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: 'transparent', border: 0, padding: '10px 4px', cursor: 'pointer',
      borderBottom: active ? '2px solid #0f172a' : '2px solid transparent',
      fontWeight: active ? 600 : 500, color: active ? '#0f172a' : '#64748b', fontSize: 14
    }}>
      {children}
    </button>
  );
}

function Badge({ tone, label }) {
  const tones = {
    ok: { bg: '#f0fdf4', fg: '#166534' },
    soon: { bg: '#eff6ff', fg: '#1e40af' },
    warn: { bg: '#fffbeb', fg: '#92400e' },
    critical: { bg: '#fef2f2', fg: '#991b1b' },
    expired: { bg: '#fee2e2', fg: '#7f1d1d' }
  };
  const t = tones[tone] || tones.ok;
  return <span style={{ background: t.bg, color: t.fg, padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 500 }}>{label}</span>;
}

function expirationLabel(item) {
  if (item.expiration_badge === 'expired') return `Expired ${Math.abs(item.days_until_expiration)}d ago`;
  if (item.days_until_expiration === 0) return 'Today';
  if (item.days_until_expiration === 1) return 'Tomorrow';
  return `${item.days_until_expiration}d`;
}

function PoliciesTable({ rows }) {
  return (
    <div style={tableWrap}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>
          {['Policy', 'Insurer', 'Coverage', 'Premium', 'Expires', 'Status'].map(h => <th key={h} style={th}>{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.map(p => (
            <tr key={p.id}>
              <td style={td}>
                <div style={{ fontWeight: 500 }}>{p.policy_type.replace(/_/g, ' ')}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{p.parent_name} · #{p.policy_number || '—'}</div>
              </td>
              <td style={td}>{p.insurer}</td>
              <td style={td}>{p.coverage_amount ? `$${Number(p.coverage_amount).toLocaleString()}` : '—'}</td>
              <td style={td}>{p.premium_annual ? `$${Number(p.premium_annual).toLocaleString()}/yr` : '—'}</td>
              <td style={td}>
                <div>{p.expiration_date}</div>
                <div style={{ marginTop: 2 }}><Badge tone={p.expiration_badge} label={expirationLabel(p)} /></div>
              </td>
              <td style={td}>{p.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CoisTable({ rows, onRequestRenewal }) {
  return (
    <div style={tableWrap}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>
          {['Vendor', 'Project', 'GL', 'Auto', 'WC', 'Umbrella', 'Expires', 'Action'].map(h => <th key={h} style={th}>{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.map(c => (
            <tr key={c.id}>
              <td style={td}>
                <div style={{ fontWeight: 500 }}>{c.company?.name || '—'}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{c.insurer} · #{c.policy_number || '—'}</div>
              </td>
              <td style={td}>{c.project?.name || '—'}</td>
              <td style={td}>{c.general_liability_amount ? `$${Number(c.general_liability_amount).toLocaleString()}` : '—'}</td>
              <td style={td}>{c.auto_liability_amount ? `$${Number(c.auto_liability_amount).toLocaleString()}` : '—'}</td>
              <td style={td}>{c.workers_comp_amount ? `$${Number(c.workers_comp_amount).toLocaleString()}` : '—'}</td>
              <td style={td}>{c.umbrella_amount ? `$${Number(c.umbrella_amount).toLocaleString()}` : '—'}</td>
              <td style={td}>
                <div>{c.expiration_date}</div>
                <div style={{ marginTop: 2 }}><Badge tone={c.expiration_badge} label={expirationLabel(c)} /></div>
              </td>
              <td style={td}>
                {c.expiration_badge === 'warn' || c.expiration_badge === 'critical' || c.expiration_badge === 'expired' ? (
                  <button onClick={() => onRequestRenewal(c.id)} style={btnSmall}>Request renewal</button>
                ) : '—'}
              </td>
            </tr>
          ))}
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
const td = { padding: '12px', borderBottom: '1px solid #f1f5f9', fontSize: 14, verticalAlign: 'top' };
const btnSmall = { background: '#0f172a', color: '#fff', border: 0, padding: '5px 10px', borderRadius: 5, fontSize: 12, cursor: 'pointer' };
