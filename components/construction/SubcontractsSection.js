'use client';

// components/construction/SubcontractsSection.js
// Subcontracts list on the project detail page. Each row is a clickable
// link into the subcontract detail page (where the AIA G702/G703 schedule
// of values lives). "+ New subcontract" opens SubcontractModal.

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Plus, FileSignature, Loader2, ChevronRight } from 'lucide-react';
import { tokens } from './_tokens';
import StatusPill from './StatusPill';
import SubcontractModal from './SubcontractModal';

export default function SubcontractsSection({ projectId }) {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/construction/projects/${projectId}/subcontracts`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setSubs(j.subcontracts || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  function handleSaved(/* subcontract */) {
    setCreating(false);
    load();
  }

  const totalContract  = subs.reduce((sum, s) => sum + Number(s.contract_value || 0), 0);
  const totalPaid      = subs.reduce((sum, s) => sum + Number(s.amount_paid    || 0), 0);
  const totalRetained  = subs.reduce((sum, s) => sum + Number(s.amount_retained|| 0), 0);
  const totalRemaining = totalContract - totalPaid;

  return (
    <section style={s.card}>
      <header style={s.head}>
        <FileSignature size={18} style={{ color: tokens.textTertiary }} />
        <h2 style={s.title}>Subcontracts</h2>
        <span style={s.count}>{subs.length}</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => setCreating(true)} style={s.addBtn}>
          <Plus size={12} />
          <span>New subcontract</span>
        </button>
      </header>

      {error && <div style={s.error}>{error}</div>}

      {loading ? (
        <div style={s.empty}><Loader2 size={14} style={{ animation: 'spin 1s linear infinite', marginRight: 6 }} />Loading…</div>
      ) : subs.length === 0 ? (
        <div style={s.empty}>No subcontracts yet. Add one to start tracking AIA G702/G703 schedule of values.</div>
      ) : (
        <>
          <div style={s.totals}>
            <Stat label="Total contract"  value={fmt(totalContract)} />
            <Stat label="Paid to date"    value={fmt(totalPaid)} />
            <Stat label="Retained"        value={fmt(totalRetained)} subtle />
            <Stat label="Remaining"       value={fmt(totalRemaining)} red={totalRemaining < 0} />
          </div>

          <div style={s.tableWrap}>
            <div style={s.tableHead}>
              <div style={{ flex: 2 }}>Vendor / scope</div>
              <div style={{ width: 100 }}>Status</div>
              <div style={{ width: 130, textAlign: 'right' }}>Contract</div>
              <div style={{ width: 130, textAlign: 'right' }}>Paid</div>
              <div style={{ width: 130, textAlign: 'right' }}>Remaining</div>
              <div style={{ width: 80,  textAlign: 'right' }}>% Done</div>
              <div style={{ width: 24 }} />
            </div>
            {subs.map(sub => (
              <Link
                key={sub.id}
                href={`/construction/${projectId}/subcontracts/${sub.id}`}
                style={s.row}
              >
                <div style={{ flex: 2, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, color: tokens.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sub.vendor_name || <span style={{ color: tokens.textTertiary, fontStyle: 'italic' }}>no vendor</span>}
                  </div>
                  <div style={{ color: tokens.textSecondary, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sub.scope}
                  </div>
                </div>
                <div style={{ width: 100 }}><StatusPill status={sub.status} /></div>
                <div style={{ width: 130, textAlign: 'right', fontSize: 13 }}>{fmt(sub.contract_value)}</div>
                <div style={{ width: 130, textAlign: 'right', fontSize: 13 }}>{fmt(sub.amount_paid)}</div>
                <div style={{ width: 130, textAlign: 'right', fontSize: 13, color: sub.remaining_balance < 0 ? tokens.errorText : tokens.textPrimary }}>
                  {fmt(sub.remaining_balance)}
                </div>
                <div style={{ width: 80, textAlign: 'right', fontSize: 13, color: tokens.textSecondary }}>
                  {sub.pct_complete}%
                </div>
                <div style={{ width: 24, color: tokens.textTertiary, display: 'flex', justifyContent: 'flex-end' }}>
                  <ChevronRight size={16} />
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {creating && (
        <SubcontractModal
          projectId={projectId}
          onClose={() => setCreating(false)}
          onSaved={handleSaved}
        />
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </section>
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
  if (n == null) return '—';
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const s = {
  card: {
    background: tokens.surface,
    border: `1px solid ${tokens.border}`,
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
  },
  head: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 },
  title: { margin: 0, fontSize: 14, color: tokens.textPrimary, fontWeight: 600 },
  count: {
    background: tokens.surfaceMuted, color: tokens.textSecondary,
    padding: '1px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
  },
  addBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    background: tokens.primary, color: '#fff', border: 0,
    padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer',
  },
  empty: { padding: 24, textAlign: 'center', color: tokens.textTertiary, fontSize: 13 },
  error: { background: tokens.errorBg, color: tokens.errorText, padding: 8, borderRadius: 6, fontSize: 13, marginBottom: 8 },
  totals: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 12, marginBottom: 12,
    padding: 12, background: tokens.surfaceMuted, borderRadius: 6,
  },
  stat: { display: 'flex', flexDirection: 'column', gap: 2 },
  statLabel: { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, color: tokens.textTertiary },
  statValue: { fontSize: 16, fontWeight: 600, color: tokens.textPrimary },
  tableWrap: { display: 'flex', flexDirection: 'column' },
  tableHead: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '4px 0', fontSize: 11, fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: 0.4,
    color: tokens.textTertiary,
    borderBottom: `1px solid ${tokens.border}`, marginBottom: 4,
  },
  row: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 0',
    borderBottom: `1px solid ${tokens.surfaceMuted}`,
    textDecoration: 'none', color: 'inherit',
  },
};
