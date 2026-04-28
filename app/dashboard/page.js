// app/dashboard/page.js
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function DashboardPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/dashboard').then(r => r.json()).then(setData);
  }, []);

  if (!data) return <PageWrap><p>Loading…</p></PageWrap>;

  return (
    <PageWrap>
      <h1 style={{ margin: 0, fontSize: 26 }}>Good morning</h1>
      <p style={{ marginTop: 4, color: '#64748b' }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>

      <Section title="Today" link="/calendar">
        <Stat label="Cleanings scheduled" value={data.cleaning.today_count} href="/short-term/cleaning" />
        <Stat label="Inspections this week" value={data.construction.inspections_this_week} href="/construction/inspections" />
        <Stat label="Reminders next 30d" value={data.alerts.upcoming_reminders} href="/inbox" tone={data.alerts.upcoming_reminders > 0 ? 'warn' : 'ok'} />
      </Section>

      <Section title="Construction" link="/construction">
        <Stat label="Active projects" value={data.construction.active_projects} href="/construction" />
        <Stat label="Open inspections" value={data.construction.open_inspections} href="/construction/inspections" />
        <Stat label="Active subcontracts" value={data.construction.active_subcontracts} href="/construction/subcontracts" />
      </Section>

      <Section title="Insurance & Compliance" link="/insurance">
        <Stat label="Policies expiring 60d" value={data.insurance.policies_expiring_60d} href="/insurance" tone={data.insurance.policies_expiring_60d > 0 ? 'warn' : 'ok'} />
        <Stat label="COIs expiring 30d" value={data.insurance.coi_expiring_30d} href="/insurance?tab=coi" tone={data.insurance.coi_expiring_30d > 0 ? 'warn' : 'ok'} />
      </Section>

      <Section title="Long Term" link="/long-term">
        <Stat label="Active leases" value={data.ltr.active_leases} href="/long-term/leases" />
      </Section>

      <Section title="Portfolio">
        <Stat label="Entities (LLCs)" value={data.portfolio.entities} href="/settings" />
        <Stat label="Properties" value={data.portfolio.properties} href="/short-term/properties" />
      </Section>
    </PageWrap>
  );
}

function PageWrap({ children }) {
  return <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 28px' }}>{children}</div>;
}
function Section({ title, link, children }) {
  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.6, color: '#64748b' }}>{title}</h2>
        {link && <Link href={link} style={{ fontSize: 12, color: '#64748b' }}>View →</Link>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {children}
      </div>
    </div>
  );
}
function Stat({ label, value, href, tone = 'neutral' }) {
  const tones = {
    neutral: { bg: '#fff', border: '#e2e8f0', value: '#0f172a' },
    warn:    { bg: '#fffbeb', border: '#fde68a', value: '#92400e' },
    ok:      { bg: '#f0fdf4', border: '#bbf7d0', value: '#166534' }
  };
  const t = tones[tone];
  const inner = (
    <div style={{
      background: t.bg, border: `1px solid ${t.border}`, borderRadius: 10,
      padding: '14px 16px', cursor: href ? 'pointer' : 'default'
    }}>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 600, color: t.value }}>{value}</div>
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: 'none' }}>{inner}</Link> : inner;
}
