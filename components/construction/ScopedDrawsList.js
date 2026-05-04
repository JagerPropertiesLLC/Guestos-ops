'use client';

// components/construction/ScopedDrawsList.js
// Compact draws list scoped to a single subcontract or loan. Used by the
// subcontract detail page and the loan detail page. Reuses DrawModal with
// scopeLocked=true to preset the link to the parent.

import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Loader2, ArrowUpRight } from 'lucide-react';
import { tokens } from './_tokens';
import StatusPill from './StatusPill';
import DrawModal from './DrawModal';

export default function ScopedDrawsList({
  projectId,
  subcontractId,            // exactly one of these two should be set
  loanId,
  subcontracts = [], loans = [],   // pass-through for the modal type/target dropdowns
  onChanged,
}) {
  const [draws, setDraws]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [editing, setEditing] = useState(null);

  const filterParam = subcontractId
    ? `subcontract_id=${subcontractId}`
    : (loanId ? `project_loan_id=${loanId}` : '');

  const presetType = subcontractId ? 'subcontractor' : (loanId ? 'loan' : undefined);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/construction/projects/${projectId}/draws?${filterParam}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setDraws(j.draws || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [projectId, filterParam]);

  useEffect(() => { load(); }, [load]);

  function handleSaved() {
    setEditing(null);
    load();
    onChanged?.();
  }

  async function handleDelete(id) {
    if (!confirm('Delete this draw?')) return;
    try {
      const r = await fetch(`/api/construction/projects/${projectId}/draws/${id}`, { method: 'DELETE' });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${r.status}`);
      }
      load();
      onChanged?.();
    } catch (e) {
      setError(e.message);
    }
  }

  const total     = draws.reduce((sum, d) => sum + Number(d.amount || 0), 0);
  const totalPaid = draws.filter(d => d.status === 'paid').reduce((sum, d) => sum + Number(d.amount || 0), 0);

  return (
    <section style={s.card}>
      <header style={s.head}>
        <ArrowUpRight size={18} style={{ color: tokens.textTertiary }} />
        <h2 style={s.title}>Draws</h2>
        <span style={s.count}>{draws.length}</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => setEditing({})} style={s.addBtn}>
          <Plus size={12} />
          <span>New draw</span>
        </button>
      </header>

      <div style={s.summary}>
        <strong>{fmt(total)}</strong> requested · {fmt(totalPaid)} paid
      </div>

      {error && <div style={s.error}>{error}</div>}

      {loading ? (
        <div style={s.empty}><Loader2 size={14} style={{ animation: 'spin 1s linear infinite', marginRight: 6 }} />Loading…</div>
      ) : draws.length === 0 ? (
        <div style={s.empty}>No draws yet against this {subcontractId ? 'subcontract' : 'loan'}.</div>
      ) : (
        <div style={s.tableWrap}>
          <div style={s.tableHead}>
            <div style={{ width: 50 }}>#</div>
            <div style={{ width: 90 }}>Date</div>
            <div style={{ width: 120 }}>Status</div>
            <div style={{ flex: 1, textAlign: 'right' }}>Amount</div>
            <div style={{ width: 70, textAlign: 'center' }}>Lien?</div>
            <div style={{ width: 70, textAlign: 'right' }}>Actions</div>
          </div>
          {draws.map(d => (
            <div key={d.id} style={s.row}>
              <div style={{ width: 50, fontSize: 12, color: tokens.textSecondary }}>#{d.draw_number ?? '—'}</div>
              <div style={{ width: 90, fontSize: 13 }}>{d.paid_date || d.request_date || '—'}</div>
              <div style={{ width: 120 }}><StatusPill status={d.status} /></div>
              <div style={{ flex: 1, textAlign: 'right', fontSize: 13, fontWeight: 600 }}>{fmt(d.amount)}</div>
              <div style={{ width: 70, textAlign: 'center', fontSize: 12 }}>
                {d.lien_waiver_received
                  ? <span style={{ color: tokens.textPrimary }} title={d.lien_waiver_type || ''}>✓</span>
                  : <span style={{ color: tokens.textTertiary }}>—</span>}
              </div>
              <div style={{ width: 70, textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                <button onClick={() => setEditing(d)} style={s.iconBtn} title="Edit"><Pencil size={14} /></button>
                <button onClick={() => handleDelete(d.id)} style={{ ...s.iconBtn, color: tokens.errorText }} title="Delete"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing !== null && (
        <DrawModal
          projectId={projectId}
          draw={editing}
          subcontracts={subcontracts}
          loans={loans}
          presetSubcontractId={subcontractId}
          presetLoanId={loanId}
          presetDrawType={presetType}
          scopeLocked
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}

function fmt(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const s = {
  card: { background: tokens.surface, border: `1px solid ${tokens.border}`, borderRadius: 10, padding: 16, marginBottom: 12 },
  head: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 },
  title: { margin: 0, fontSize: 14, color: tokens.textPrimary, fontWeight: 600 },
  count: { background: tokens.surfaceMuted, color: tokens.textSecondary, padding: '1px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 },
  addBtn: { display: 'inline-flex', alignItems: 'center', gap: 4, background: tokens.primary, color: '#fff', border: 0, padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer' },
  summary: { fontSize: 13, color: tokens.textPrimary, marginBottom: 12 },
  empty: { padding: 24, textAlign: 'center', color: tokens.textTertiary, fontSize: 13 },
  error: { background: tokens.errorBg, color: tokens.errorText, padding: 8, borderRadius: 6, fontSize: 13, marginBottom: 8 },
  tableWrap: { display: 'flex', flexDirection: 'column' },
  tableHead: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, color: tokens.textTertiary, borderBottom: `1px solid ${tokens.border}`, marginBottom: 4 },
  row: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: `1px solid ${tokens.surfaceMuted}` },
  iconBtn: { background: 'transparent', border: 0, padding: 4, cursor: 'pointer', color: tokens.textTertiary, display: 'inline-flex' },
};
