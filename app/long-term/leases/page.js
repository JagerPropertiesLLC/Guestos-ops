// app/long-term/leases/page.js
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function TenantsLeasesPage() {
  const [tab, setTab] = useState('active');
  const [leases, setLeases] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/leases').then(r => r.ok ? r.json() : { leases: [] }).catch(() => ({ leases: [] })),
      fetch('/api/tenants').then(r => r.ok ? r.json() : { tenants: [] }).catch(() => ({ tenants: [] }))
    ]).then(([l, t]) => {
      setLeases(l.leases || []);
      setTenants(t.tenants || []);
      setLoading(false);
    });
  }, []);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 28px' }}>
      <h1 style={{ margin: 0, fontSize: 26 }}>Tenants & Leases</h1>
      <p style={{ marginTop: 4, color: '#64748b' }}>Active leases, tenants, and renewal status across the long-term portfolio.</p>

      <div style={{ display: 'flex', gap: 16, borderBottom: '1px solid #e2e8f0', marginTop: 20, marginBottom: 20 }}>
        <Tab active={tab === 'active'}   onClick={() => setTab('active')}>Active Leases ({leases.filter(l => l.renewal_status === 'active').length})</Tab>
        <Tab active={tab === 'expiring'} onClick={() => setTab('expiring')}>Expiring Soon</Tab>
        <Tab active={tab === 'tenants'}  onClick={() => setTab('tenants')}>All Tenants ({tenants.length})</Tab>
      </div>

      {loading && <p>Loading…</p>}

      {!loading && (leases.length === 0 && tenants.length === 0) && (
        <Empty title="No tenants or leases yet"
          hint="Add your first lease to start tracking rent, deposits, and renewal dates. The Aurora portfolio data hasn't been backfilled yet — that comes when Wendy onboards." />
      )}

      {!loading && tab === 'tenants' && tenants.length > 0 && <TenantsTable rows={tenants} />}
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

function TenantsTable({ rows }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>
          {['Name', 'Email', 'Phone', 'Property', 'Rent', 'Lease ends'].map(h => (
            <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #e2e8f0', fontWeight: 600 }}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {rows.map(t => (
            <tr key={t.id}>
              <td style={td}><strong>{t.first_name} {t.last_name}</strong></td>
              <td style={td}>{t.email || '—'}</td>
              <td style={td}>{t.phone || '—'}</td>
              <td style={td}>—</td>
              <td style={td}>—</td>
              <td style={td}>—</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Empty({ title, hint }) {
  return (
    <div style={{ padding: 40, textAlign: 'center', background: '#fff', border: '1px dashed #cbd5e1', borderRadius: 10 }}>
      <div style={{ fontSize: 16, fontWeight: 500 }}>{title}</div>
      <div style={{ fontSize: 13, color: '#64748b', marginTop: 6, maxWidth: 500, marginLeft: 'auto', marginRight: 'auto' }}>{hint}</div>
    </div>
  );
}

const td = { padding: '12px', borderBottom: '1px solid #f1f5f9', fontSize: 14 };
