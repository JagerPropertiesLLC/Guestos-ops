'use client';

// components/construction/LineItemsRollupBar.js
// Totals strip for the AIA G702/G703 schedule of values. Shows contract
// (header total), paid-to-date / retainage / remaining (computed from line
// items), and dollar-weighted overall % complete.

import { tokens } from './_tokens';

export default function LineItemsRollupBar({ subcontract }) {
  const contract = Number(subcontract.contract_value || 0);
  const paid     = Number(subcontract.amount_paid || 0);
  const retained = Number(subcontract.amount_retained || 0);
  const remaining= Number(subcontract.remaining_balance ?? (contract - paid));
  const pct      = Number(subcontract.pct_complete || 0);

  return (
    <div style={s.bar}>
      <Stat label="Contract amount" value={fmt(contract)} />
      <Stat label="Paid to date"    value={fmt(paid)} />
      <Stat label="Retainage held"  value={fmt(retained)} subtle />
      <Stat label="Remaining"       value={fmt(remaining)} red={remaining < 0} />
      <Stat label="% complete"      value={`${pct}%`} />
    </div>
  );
}

function Stat({ label, value, subtle, red }) {
  return (
    <div style={s.stat}>
      <div style={s.statLabel}>{label}</div>
      <div style={{ ...s.statValue, ...(red ? { color: tokens.errorText } : {}), ...(subtle ? { color: tokens.textSecondary } : {}) }}>
        {value}
      </div>
    </div>
  );
}

function fmt(n) {
  return Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const s = {
  bar: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: 12, padding: 12, background: tokens.surfaceMuted, borderRadius: 6,
    marginBottom: 12,
  },
  stat: { display: 'flex', flexDirection: 'column', gap: 2 },
  statLabel: { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, color: tokens.textTertiary },
  statValue: { fontSize: 16, fontWeight: 600, color: tokens.textPrimary },
};
