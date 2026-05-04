'use client';

// components/construction/LoansSection.js
// Loans list on the project detail page. Each row links to the loan detail
// page (where draws against this loan live). "+ New loan" opens LoanModal.

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Banknote, Loader2, ChevronRight } from 'lucide-react';
import { tokens } from './_tokens';
import StatusPill from './StatusPill';
import LoanModal from './LoanModal';

export default function LoansSection({ projectId }) {
  const [loans, setLoans]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/construction/projects/${projectId}/loans`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setLoans(j.loans || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  function handleSaved() { setCreating(false); load(); }

  const totalLoan      = loans.reduce((sum, l) => sum + Number(l.total_loan_amount || 0), 0);
  const totalDrawn     = loans.reduce((sum, l) => sum + Number(l.drawn_to_date     || 0), 0);
  const totalAvailable = totalLoan - totalDrawn;

  return (
    <section style={s.card}>
      <header style={s.head}>
        <Banknote size={18} style={{ color: tokens.textTertiary }} />
        <h2 style={s.title}>Loans</h2>
        <span style={s.count}>{loans.length}</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => setCreating(true)} style={s.addBtn}>
          <Plus size={12} />
          <span>New loan</span>
        </button>
      </header>

      {error && <div style={s.error}>{error}</div>}

      {loading ? (
        <div style={s.empty}><Loader2 size={14} style={{ animation: 'spin 1s linear infinite', marginRight: 6 }} />Loading…</div>
      ) : loans.length === 0 ? (
        <div style={s.empty}>No loans yet. Add a construction loan to start tracking draws against it.</div>
      ) : (
        <>
          <div style={s.totals}>
            <Stat label="Total loaned"  value={fmt(totalLoan)} />
            <Stat label="Drawn to date" value={fmt(totalDrawn)} />
            <Stat label="Available"     value={fmt(totalAvailable)} red={totalAvailable < 0} />
          </div>

          <div style={s.tableWrap}>
            <div style={s.tableHead}>
              <div style={{ flex: 2 }}>Lender / number</div>
              <div style={{ width: 100 }}>Status</div>
              <div style={{ width: 130, textAlign: 'right' }}>Total</div>
              <div style={{ width: 130, textAlign: 'right' }}>Drawn</div>
              <div style={{ width: 130, textAlign: 'right' }}>Available</div>
              <div style={{ width: 80,  textAlign: 'right' }}>% Drawn</div>
              <div style={{ width: 24 }} />
            </div>
            {loans.map(loan => (
              <Link key={loan.id} href={`/construction/${projectId}/loans/${loan.id}`} style={s.row}>
                <div style={{ flex: 2, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, color: tokens.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {loan.lender_display_name || <span style={{ color: tokens.textTertiary, fontStyle: 'italic' }}>no lender</span>}
                  </div>
                  {loan.loan_number && (
                    <div style={{ color: tokens.textSecondary, fontSize: 12 }}>#{loan.loan_number}</div>
                  )}
                </div>
                <div style={{ width: 100 }}><StatusPill status={loan.status} /></div>
                <div style={{ width: 130, textAlign: 'right', fontSize: 13 }}>{fmt(loan.total_loan_amount)}</div>
                <div style={{ width: 130, textAlign: 'right', fontSize: 13 }}>{fmt(loan.drawn_to_date)}</div>
                <div style={{ width: 130, textAlign: 'right', fontSize: 13, color: loan.available_balance < 0 ? tokens.errorText : tokens.textPrimary }}>
                  {fmt(loan.available_balance)}
                </div>
                <div style={{ width: 80, textAlign: 'right', fontSize: 13, color: tokens.textSecondary }}>
                  {loan.pct_drawn ?? 0}%
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
        <LoanModal
          projectId={projectId}
          onClose={() => setCreating(false)}
          onSaved={handleSaved}
        />
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}

function Stat({ label, value, red }) {
  return (
    <div style={s.stat}>
      <div style={s.statLabel}>{label}</div>
      <div style={{ ...s.statValue, ...(red ? { color: tokens.errorText } : {}) }}>{value}</div>
    </div>
  );
}

function fmt(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const s = {
  card: {
    background: tokens.surface, border: `1px solid ${tokens.border}`,
    borderRadius: 10, padding: 16, marginBottom: 12,
  },
  head: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 },
  title: { margin: 0, fontSize: 14, color: tokens.textPrimary, fontWeight: 600 },
  count: { background: tokens.surfaceMuted, color: tokens.textSecondary, padding: '1px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 },
  addBtn: { display: 'inline-flex', alignItems: 'center', gap: 4, background: tokens.primary, color: '#fff', border: 0, padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer' },
  empty: { padding: 24, textAlign: 'center', color: tokens.textTertiary, fontSize: 13 },
  error: { background: tokens.errorBg, color: tokens.errorText, padding: 8, borderRadius: 6, fontSize: 13, marginBottom: 8 },
  totals: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 12, padding: 12, background: tokens.surfaceMuted, borderRadius: 6 },
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
    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0',
    borderBottom: `1px solid ${tokens.surfaceMuted}`,
    textDecoration: 'none', color: 'inherit',
  },
};
