'use client';

// components/construction/ProjectCard.js
// One project tile on the /construction landing page.

import Link from 'next/link';
import { Building2, Calendar, AlertTriangle, ListTodo, FileSignature } from 'lucide-react';
import { tokens, PROJECT_TYPE_OPTIONS } from './_tokens';
import StatusPill from './StatusPill';

const TYPE_LABELS = Object.fromEntries(PROJECT_TYPE_OPTIONS.map(o => [o.value, o.label]));

function fmtMoney(n) {
  if (n == null) return '—';
  return '$' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
}
function fmtPct(n) {
  if (n == null) return '—';
  return Number(n).toFixed(0) + '%';
}
function fmtDate(s) {
  if (!s) return null;
  return new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ProjectCard({ project }) {
  const pct = project.pct_budget_spent;
  const overBudget = pct != null && Number(pct) > 100;
  const dateRange = (() => {
    const a = fmtDate(project.start_date);
    const b = fmtDate(project.target_completion);
    if (a && b) return `${a} → ${b}`;
    if (a) return `Started ${a}`;
    if (b) return `Target ${b}`;
    return 'Dates TBD';
  })();

  return (
    <Link href={`/construction/${project.id}`} style={s.card}>
      <div style={s.head}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.name}>{project.name}</div>
          <div style={s.location}>
            <Building2 size={11} style={{ marginRight: 4, verticalAlign: '-1px' }} />
            {project.address || project.property_short_name || project.entity_name || '—'}
          </div>
        </div>
        <StatusPill status={project.status} />
      </div>

      <div style={s.metaRow}>
        <span style={s.tag}>{TYPE_LABELS[project.type] || project.type || '—'}</span>
        <span style={s.tag}>{project.market_name || '—'}</span>
      </div>

      <div style={s.dates}>
        <Calendar size={11} style={{ marginRight: 4, verticalAlign: '-1px' }} />
        {dateRange}
      </div>

      <div style={s.budgetBlock}>
        <div style={s.budgetRow}>
          <span style={s.budgetLabel}>Budget</span>
          <span style={s.budgetValue}>{fmtMoney(project.total_budget)}</span>
        </div>
        <div style={s.budgetRow}>
          <span style={s.budgetLabel}>Spent</span>
          <span style={s.budgetValue}>{fmtMoney(project.total_spent)}</span>
        </div>
        <div style={s.progressBar}>
          <div style={{
            ...s.progressFill,
            width: pct != null ? `${Math.min(100, Number(pct))}%` : '0%',
            background: overBudget ? tokens.errorText : tokens.primary,
          }} />
        </div>
        <div style={s.pctRow}>
          <span style={{ color: overBudget ? tokens.errorText : tokens.textSecondary, fontWeight: overBudget ? 600 : 500 }}>
            {fmtPct(pct)} of budget
          </span>
          {overBudget && <span style={s.overBudget}>OVER</span>}
        </div>
      </div>

      <div style={s.footer}>
        <Stat icon={ListTodo} value={project.open_tasks_count} label="open tasks" />
        <Stat icon={FileSignature} value={project.subcontracts_count} label="subcontracts" />
        <Stat
          icon={AlertTriangle}
          value={project.pending_change_orders_count}
          label="pending COs"
          highlight={project.pending_change_orders_count > 0}
        />
      </div>
    </Link>
  );
}

function Stat({ icon: Icon, value, label, highlight }) {
  const color = highlight ? tokens.accent : tokens.textTertiary;
  return (
    <div style={s.stat}>
      <Icon size={12} style={{ color, marginRight: 4 }} />
      <span style={{ color: tokens.textPrimary, fontWeight: 600 }}>{value ?? 0}</span>
      <span style={s.statLabel}> {label}</span>
    </div>
  );
}

const s = {
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 16,
    background: tokens.surface,
    border: `1px solid ${tokens.border}`,
    borderRadius: 10,
    textDecoration: 'none',
    color: 'inherit',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    cursor: 'pointer',
  },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  name: {
    fontSize: 15,
    fontWeight: 600,
    color: tokens.textPrimary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  location: {
    marginTop: 4,
    fontSize: 12,
    color: tokens.textSecondary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  metaRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  tag: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 11,
    background: tokens.surfaceMuted,
    color: tokens.textSecondary,
  },
  dates: {
    fontSize: 12,
    color: tokens.textTertiary,
  },
  budgetBlock: {
    marginTop: 4,
    padding: 10,
    background: tokens.surfaceMuted,
    borderRadius: 6,
  },
  budgetRow: { display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 },
  budgetLabel: { color: tokens.textSecondary },
  budgetValue: { color: tokens.textPrimary, fontWeight: 600, fontVariantNumeric: 'tabular-nums' },
  progressBar: {
    marginTop: 6,
    height: 6,
    background: tokens.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', transition: 'width 0.2s' },
  pctRow: { marginTop: 4, display: 'flex', justifyContent: 'space-between', fontSize: 11 },
  overBudget: {
    background: tokens.errorBg,
    color: tokens.errorText,
    padding: '0 6px',
    borderRadius: 3,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 0.4,
  },
  footer: {
    marginTop: 4,
    paddingTop: 10,
    borderTop: `1px solid ${tokens.surfaceMuted}`,
    display: 'flex',
    justifyContent: 'space-between',
    gap: 8,
  },
  stat: { fontSize: 11, display: 'inline-flex', alignItems: 'center' },
  statLabel: { color: tokens.textSecondary, marginLeft: 2 },
};
