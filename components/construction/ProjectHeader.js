'use client';

// components/construction/ProjectHeader.js
// Project header card on /construction/[id]. Inline-edit name + status +
// dates + budget; other fields read-only for v1.

import { useState } from 'react';
import { Loader2, Building2, ExternalLink, MapPin } from 'lucide-react';
import { tokens, PROJECT_STATUS_OPTIONS, PROJECT_TYPE_OPTIONS } from './_tokens';
import StatusPill from './StatusPill';

const TYPE_LABELS = Object.fromEntries(PROJECT_TYPE_OPTIONS.map(o => [o.value, o.label]));

function fmtMoney(n) {
  if (n == null) return '—';
  return '$' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
}
function fmtPct(n) { return n == null ? '—' : Number(n).toFixed(1) + '%'; }
function fmtDate(s) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function ProjectHeader({ project, financials, counts, onChanged }) {
  const [saving, setSaving] = useState(null);
  const [errors, setErrors] = useState({});
  const [name, setName]                       = useState(project.name || '');
  const [totalBudget, setTotalBudget]         = useState(project.total_budget ?? '');
  const [startDate, setStartDate]             = useState(project.start_date || '');
  const [targetCompletion, setTargetCompletion] = useState(project.target_completion || '');
  const [notes, setNotes]                     = useState(project.notes || '');

  async function patch(field, value) {
    setSaving(field);
    setErrors(e => ({ ...e, [field]: null }));
    try {
      const r = await fetch(`/api/construction/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErrors(e => ({ ...e, [field]: j.message || j.error || `HTTP ${r.status}` }));
        await onChanged();
        return;
      }
      await onChanged();
    } catch (e) {
      setErrors(er => ({ ...er, [field]: e.message }));
    } finally {
      setSaving(null);
    }
  }

  const overBudget = financials?.pct_budget_spent != null && Number(financials.pct_budget_spent) > 100;

  return (
    <section style={s.card}>
      <div style={s.headRow}>
        <div style={s.iconWrap}><Building2 size={22} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.nameWrap}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => { if (name.trim() && name !== project.name) patch('name', name.trim()); }}
              style={s.nameInput}
            />
            {saving === 'name' && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: tokens.textTertiary }} />}
          </div>
          {errors.name && <div style={s.fieldErr}>{errors.name}</div>}
          {project.address && (
            <div style={s.address}>
              <MapPin size={12} style={{ marginRight: 4, verticalAlign: '-2px' }} />
              {project.address}
            </div>
          )}
          <div style={s.metaLine}>
            <span style={s.tag}>{TYPE_LABELS[project.type] || project.type || '—'}</span>
            {project.entity_name && <span style={s.tag}>{project.entity_name}</span>}
            {project.market_name && <span style={s.tag}>{project.market_name}</span>}
            {project.gc_name && <span style={s.tag}>GC: {project.gc_name}</span>}
            {project.drive_folder_url && (
              <a href={project.drive_folder_url} target="_blank" rel="noreferrer" style={s.driveLink}>
                <ExternalLink size={11} style={{ marginRight: 4, verticalAlign: '-1px' }} />
                Drive folder
              </a>
            )}
          </div>
        </div>
        <div style={s.statusWrap}>
          <StatusPill status={project.status} />
          <select
            value={project.status || ''}
            onChange={(e) => patch('status', e.target.value)}
            disabled={saving === 'status'}
            style={s.statusSelect}
          >
            {PROJECT_STATUS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {saving === 'status' && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite', color: tokens.textTertiary }} />}
        </div>
      </div>

      <div style={s.statsGrid}>
        <Stat label="Budget">
          <div style={s.budgetEditRow}>
            <span style={s.dollarPrefix}>$</span>
            <input
              type="number" step="any" min="0"
              value={totalBudget}
              onChange={(e) => setTotalBudget(e.target.value)}
              onBlur={() => {
                const v = totalBudget === '' ? null : Number(totalBudget);
                if (v !== project.total_budget) patch('total_budget', v);
              }}
              style={s.budgetInput}
            />
            {saving === 'total_budget' && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite', color: tokens.textTertiary }} />}
          </div>
          {errors.total_budget && <div style={s.fieldErr}>{errors.total_budget}</div>}
        </Stat>

        <Stat label="Spent" hint="Expenses paid + draws paid (auto)">
          <div style={s.statValue}>{fmtMoney(financials?.total_spent)}</div>
        </Stat>

        <Stat label="Remaining" hint="Budget − spent (auto)">
          <div style={{ ...s.statValue, color: overBudget ? tokens.errorText : tokens.textPrimary }}>
            {fmtMoney(financials?.budget_remaining)}
          </div>
        </Stat>

        <Stat label="% spent">
          <div style={{ ...s.statValue, color: overBudget ? tokens.errorText : tokens.textPrimary }}>
            {fmtPct(financials?.pct_budget_spent)}
            {overBudget && <span style={s.overBadge}>OVER</span>}
          </div>
        </Stat>

        <Stat label="Start">
          <input
            type="date"
            value={startDate || ''}
            onChange={(e) => setStartDate(e.target.value)}
            onBlur={() => { if ((startDate || null) !== (project.start_date || null)) patch('start_date', startDate || null); }}
            style={s.dateInput}
          />
        </Stat>

        <Stat label="Target completion">
          <input
            type="date"
            value={targetCompletion || ''}
            onChange={(e) => setTargetCompletion(e.target.value)}
            onBlur={() => { if ((targetCompletion || null) !== (project.target_completion || null)) patch('target_completion', targetCompletion || null); }}
            style={s.dateInput}
          />
        </Stat>
      </div>

      <div style={s.countsRow}>
        <CountChip label="Open tasks"        n={counts?.open_tasks} />
        <CountChip label="Subcontracts"      n={counts?.subcontracts} />
        <CountChip label="Pending COs"       n={counts?.pending_change_orders} highlight={counts?.pending_change_orders > 0} />
      </div>

      <div style={s.notesBlock}>
        <div style={s.notesLabel}>Notes</div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => { if (notes !== (project.notes || '')) patch('notes', notes || null); }}
          rows={3}
          style={s.notes}
          placeholder="Internal project notes…"
        />
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}

function Stat({ label, hint, children }) {
  return (
    <div>
      <div style={s.statLabel}>{label}{hint && <span style={s.statHint} title={hint}> ⓘ</span>}</div>
      {children}
    </div>
  );
}

function CountChip({ label, n, highlight }) {
  return (
    <div style={{
      ...s.countChip,
      borderColor: highlight ? tokens.accent : tokens.border,
      background: highlight ? tokens.accentBgTint : tokens.surface,
    }}>
      <span style={{ ...s.countN, color: highlight ? tokens.accentText : tokens.textPrimary }}>{n ?? 0}</span>
      <span style={s.countLabel}>{label}</span>
    </div>
  );
}

const s = {
  card: {
    background: tokens.surface,
    border: `1px solid ${tokens.border}`,
    borderRadius: 10,
    padding: 24,
    marginBottom: 20,
  },
  headRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 16,
    paddingBottom: 16,
    marginBottom: 16,
    borderBottom: `1px solid ${tokens.surfaceMuted}`,
  },
  iconWrap: {
    background: tokens.primaryBgTint,
    color: tokens.primary,
    width: 44, height: 44,
    borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  nameWrap: { display: 'flex', alignItems: 'center', gap: 8 },
  nameInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: 600,
    color: tokens.textPrimary,
    border: '1px solid transparent',
    background: 'transparent',
    padding: '2px 6px',
    margin: '-2px -6px',
    borderRadius: 4,
    fontFamily: 'inherit',
  },
  fieldErr: { marginTop: 4, fontSize: 12, color: tokens.errorText },
  address: { marginTop: 6, fontSize: 13, color: tokens.textSecondary },
  metaLine: { marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' },
  tag: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 11,
    background: tokens.surfaceMuted,
    color: tokens.textSecondary,
  },
  driveLink: {
    fontSize: 11,
    color: tokens.primary,
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    fontWeight: 500,
  },
  statusWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 6,
  },
  statusSelect: {
    padding: '4px 8px',
    fontSize: 12,
    border: `1px solid ${tokens.border}`,
    borderRadius: 6,
    background: tokens.surface,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 16,
    marginBottom: 16,
  },
  statLabel: {
    fontSize: 11,
    color: tokens.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: 600,
    marginBottom: 6,
  },
  statHint: { color: tokens.textTertiary, cursor: 'help' },
  statValue: {
    fontSize: 18,
    color: tokens.textPrimary,
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
  },
  budgetEditRow: { display: 'flex', alignItems: 'center', gap: 4 },
  dollarPrefix: { fontSize: 16, color: tokens.textSecondary, fontWeight: 600 },
  budgetInput: {
    flex: 1,
    fontSize: 16,
    color: tokens.textPrimary,
    fontWeight: 600,
    border: `1px solid ${tokens.border}`,
    background: tokens.surface,
    padding: '4px 6px',
    borderRadius: 4,
    fontFamily: 'inherit',
    fontVariantNumeric: 'tabular-nums',
    minWidth: 0,
    width: '100%',
  },
  dateInput: {
    fontSize: 13,
    color: tokens.textPrimary,
    border: `1px solid ${tokens.border}`,
    background: tokens.surface,
    padding: '4px 6px',
    borderRadius: 4,
    fontFamily: 'inherit',
  },
  overBadge: {
    marginLeft: 6,
    background: tokens.errorBg,
    color: tokens.errorText,
    padding: '0 6px',
    borderRadius: 3,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 0.4,
  },
  countsRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  countChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    border: `1px solid ${tokens.border}`,
    borderRadius: 8,
    background: tokens.surface,
  },
  countN: { fontWeight: 700, fontSize: 16 },
  countLabel: { fontSize: 12, color: tokens.textSecondary },
  notesBlock: {},
  notesLabel: {
    fontSize: 11,
    color: tokens.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: 600,
    marginBottom: 6,
  },
  notes: {
    width: '100%',
    padding: '8px 10px',
    border: `1px solid ${tokens.border}`,
    borderRadius: 6,
    fontSize: 13,
    background: tokens.surface,
    fontFamily: 'inherit',
    resize: 'vertical',
    color: tokens.textPrimary,
  },
};
