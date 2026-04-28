// app/reports/page.js
'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

function fmt(n) { return n != null ? `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'; }

export default function ReportsPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/dashboard-finance').then(r => r.json()).then(setData);
  }, []);

  if (!data) return <div style={pageWrap}><p>Loading…</p></div>;

  return (
    <div style={pageWrap}>
      <h1 style={{ margin: 0, fontSize: 26 }}>Reports</h1>
      <p style={{ marginTop: 4, color: '#64748b' }}>
        Financial dashboard. Rent collected, costs, trends. Not accounting — for "is something off?" awareness.
      </p>
      <p style={{ marginTop: 6, fontSize: 12, color: '#94a3b8' }}>
        QBO remains the source of truth for accounting. This view tracks day-to-day operational money flow.
      </p>

      <h2 style={sectionH}>Income</h2>
      <div style={grid}>
        <Stat label="Rent collected MTD" value={fmt(data.income.collected_mtd)} Icon={TrendingUp} tone="ok" />
        <Stat label="Rent collected YTD" value={fmt(data.income.collected_ytd)} Icon={TrendingUp} tone="ok" />
        <Stat label="Overdue / pending" value={fmt(data.income.owed_overdue)} Icon={DollarSign} tone={data.income.owed_overdue > 0 ? 'warn' : 'neutral'} />
      </div>

      <h2 style={sectionH}>Costs</h2>
      <div style={grid}>
        <Stat label="Maintenance MTD" value={fmt(data.costs.maintenance_mtd)} Icon={TrendingDown} />
        <Stat label="Utilities MTD" value={fmt(data.costs.utilities_mtd)} Icon={TrendingDown} />
        <Stat label="Maintenance YTD" value={fmt(data.costs.maintenance_ytd)} Icon={TrendingDown} />
        <Stat label="Utilities YTD" value={fmt(data.costs.utilities_ytd)} Icon={TrendingDown} />
        <Stat label="Property tax YTD" value={fmt(data.costs.property_tax_ytd)} Icon={TrendingDown} />
        <Stat label="Total costs YTD" value={fmt(data.costs.total_ytd)} Icon={TrendingDown} tone="warn" />
      </div>

      <h2 style={sectionH}>Net (income − tracked costs)</h2>
      <div style={grid}>
        <Stat label="Net MTD" value={fmt(data.net.mtd)} tone={data.net.mtd >= 0 ? 'ok' : 'warn'} />
        <Stat label="Net YTD" value={fmt(data.net.ytd)} tone={data.net.ytd >= 0 ? 'ok' : 'warn'} />
      </div>

      <h2 style={sectionH}>Rent collected by month</h2>
      {data.series.rent_by_month.length === 0 ? (
        <div style={{ padding: 30, textAlign: 'center', background: '#fff', border: '1px dashed #cbd5e1', borderRadius: 8, color: '#64748b' }}>
          No rent payments tracked yet. As you log tenant payments, this chart populates.
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 20 }}>
          <BarChart data={data.series.rent_by_month} />
        </div>
      )}

      <div style={{ marginTop: 28, padding: 16, background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8, fontSize: 13, color: '#713f12' }}>
        <strong>Heads up:</strong> Numbers above only reflect data that's been logged in this system. Until you start logging tenant_payments and maintenance_requests with cost values, most of these will be $0.
      </div>
    </div>
  );
}

function Stat({ label, value, Icon, tone = 'neutral' }) {
  const tones = {
    neutral: { bg: '#fff', border: '#e2e8f0', value: '#0f172a' },
    warn:    { bg: '#fffbeb', border: '#fde68a', value: '#92400e' },
    ok:      { bg: '#f0fdf4', border: '#bbf7d0', value: '#166534' }
  };
  const t = tones[tone];
  return (
    <div style={{
      background: t.bg, border: `1px solid ${t.border}`, borderRadius: 10, padding: '14px 16px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
        {Icon && <Icon size={14} color="#94a3b8" />}
      </div>
      <div style={{ fontSize: 24, fontWeight: 600, color: t.value, marginTop: 6 }}>{value}</div>
    </div>
  );
}

function BarChart({ data }) {
  const max = Math.max(...data.map(d => d.amount), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 140 }}>
      {data.map(d => (
        <div key={d.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{fmt(d.amount)}</div>
          <div style={{
            width: '100%', height: `${(d.amount / max) * 100}%`,
            background: '#0f172a', borderRadius: '4px 4px 0 0', minHeight: 2
          }} />
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
            {new Date(d.month + '-01').toLocaleDateString('en-US', { month: 'short' })}
          </div>
        </div>
      ))}
    </div>
  );
}

const pageWrap = { maxWidth: 1200, margin: '0 auto', padding: '24px 28px' };
const sectionH = { fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.6, color: '#64748b', marginTop: 28, marginBottom: 12 };
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 };
