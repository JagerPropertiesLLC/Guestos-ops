'use client';

// components/construction/DrawsSection.js
// Project-wide draws list with filters (status / type / subcontract / loan).
// Loads subcontracts + loans alongside so DrawModal can offer them as
// scoped picks.

import { useEffect, useState, useCallback } from 'react';
import { Plus, ArrowUpRight, Pencil, Trash2, Loader2 } from 'lucide-react';
import { tokens } from './_tokens';
import StatusPill from './StatusPill';
import DrawModal from './DrawModal';

const TYPE_LABELS = {
  subcontractor: 'Subcontractor',
  loan: 'Loan draw',
  owner: 'Owner',
  other: 'Other',
};

export default function DrawsSection({ projectId }) {
  const [draws, setDraws]               = useState([]);
  const [subcontracts, setSubcontracts] = useState([]);
  const [loans, setLoans]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [editing, setEditing]           = useState(null);
  const [filters, setFilters]           = useState({ status: '', draw_type: '', subcontract_id: '', project_loan_id: '' });

  const loadAdjacent = useCallback(async () => {
    try {
      const [sRes, lRes] = await Promise.all([
        fetch(`/api/construction/projects/${projectId}/subcontracts`),
        fetch(`/api/construction/projects/${projectId}/loans`),
      ]);
      const sj = await sRes.json();
      const lj = await lRes.json();
      setSubcontracts(sj.subcontracts || []);
      setLoans(lj.loans || []);
    } catch (_) { /* non-fatal — list still works */ }
  }, [projectId]);

  const loadDraws = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
      const url = `/api/construction/projects/${projectId}/draws${params.toString() ? '?' + params : ''}`;
      const r = await fetch(url);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setDraws(j.draws || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [projectId, filters]);

  useEffect(() => { loadAdjacent(); }, [loadAdjacent]);
  useEffect(() => { loadDraws(); }, [loadDraws]);

  function handleSaved() {
    setEditing(null);
    loadDraws();
    loadAdjacent(); // loan rollups change
  }

  async function handleDelete(id) {
    if (!confirm('Delete this draw?')) return;
    try {
      const r = await fetch(`/api/construction/projects/${projectId}/draws/${id}`, { method: 'DELETE' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setDraws(draws.filter(d => d.id !== id));
      loadAdjacent();
    } catch (e) {
      setError(e.message);
    }
  }

  const total      = draws.reduce((sum, d) => sum + Number(d.amount || 0), 0);
  const totalPaid  = draws.filter(d => d.status === 'paid').reduce((sum, d) => sum + Number(d.amount || 0), 0);
  const filtersActive = Object.values(filters).some(Boolean);

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

      <div style={s.filters}>
        <FilterSelect value={filters.status} onChange={(v) => setFilters({ ...filters, status: v })} options={[
          { value: '', label: 'All statuses' },
          { value: 'pending',   label: 'Pending' },
          { value: 'approved',  label: 'Approved' },
          { value: 'paid',      label: 'Paid' },
          { value: 'rejected',  label: 'Rejected' },
          { value: 'cancelled', label: 'Cancelled' },
        ]} />
        <FilterSelect value={filters.draw_type} onChange={(v) => setFilters({ ...filters, draw_type: v })} options={[
          { value: '', label: 'All types' },
          { value: 'subcontractor', label: 'Subcontractor' },
          { value: 'loan',          label: 'Loan' },
          { value: 'owner',         label: 'Owner' },
          { value: 'other',         label: 'Other' },
        ]} />
        <FilterSelect value={filters.subcontract_id} onChange={(v) => setFilters({ ...filters, subcontract_id: v })} options={[
          { value: '', label: 'All subcontracts' },
          { value: 'null', label: '— no sub —' },
          ...subcontracts.map(s => ({ value: s.id, label: `${s.vendor_name || s.vendor?.name || '(no vendor)'} — ${(s.scope || '').slice(0, 30)}` })),
        ]} />
        <FilterSelect value={filters.project_loan_id} onChange={(v) => setFilters({ ...filters, project_loan_id: v })} options={[
          { value: '', label: 'All loans' },
          { value: 'null', label: '— no loan —' },
          ...loans.map(l => ({ value: l.id, label: l.lender_display_name || l.lender_name || '(no lender)' })),
        ]} />
        {filtersActive && (
          <button onClick={() => setFilters({ status: '', draw_type: '', subcontract_id: '', project_loan_id: '' })} style={s.clearBtn}>Clear</button>
        )}
      </div>

      <div style={s.summary}>
        <span><strong>{fmt(total)}</strong> total ({draws.length} {draws.length === 1 ? 'draw' : 'draws'})</span>
        <span style={{ color: tokens.textSecondary }}> · {fmt(totalPaid)} paid · {fmt(total - totalPaid)} unpaid</span>
      </div>

      {error && <div style={s.error}>{error}</div>}

      {loading ? (
        <div style={s.empty}><Loader2 size={14} style={{ animation: 'spin 1s linear infinite', marginRight: 6 }} />Loading…</div>
      ) : draws.length === 0 ? (
        <div style={s.empty}>{filtersActive ? 'No draws match those filters.' : 'No draws yet. Click "New draw" to log the first cash event.'}</div>
      ) : (
        <div style={s.tableWrap}>
          <div style={s.tableHead}>
            <div style={{ width: 50 }}>#</div>
            <div style={{ width: 90 }}>Date</div>
            <div style={{ flex: 1.4 }}>Type / target</div>
            <div style={{ width: 100 }}>Status</div>
            <div style={{ width: 100, textAlign: 'right' }}>Amount</div>
            <div style={{ width: 70,  textAlign: 'center' }}>Lien?</div>
            <div style={{ width: 70,  textAlign: 'right' }}>Actions</div>
          </div>
          {draws.map(d => (
            <div key={d.id} style={s.row}>
              <div style={{ width: 50, fontSize: 12, color: tokens.textSecondary }}>#{d.draw_number ?? '—'}</div>
              <div style={{ width: 90, fontSize: 13 }}>{d.paid_date || d.request_date || '—'}</div>
              <div style={{ flex: 1.4, fontSize: 13, minWidth: 0 }}>
                <div style={{ fontWeight: 500, color: tokens.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {TYPE_LABELS[d.draw_type] || d.draw_type}
                </div>
                <div style={{ color: tokens.textSecondary, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {d.subcontract?.company?.name || d.loan?.lender_name || (d.subcontract ? `(no vendor) — ${d.subcontract.scope?.slice(0, 30)}` : '')}
                </div>
              </div>
              <div style={{ width: 100 }}><StatusPill status={d.status} /></div>
              <div style={{ width: 100, textAlign: 'right', fontSize: 13, fontWeight: 600 }}>{fmt(d.amount)}</div>
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
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}

function FilterSelect({ value, onChange, options }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={s.filterSelect}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
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
  filters: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  filterSelect: { padding: '5px 8px', border: `1px solid ${tokens.border}`, borderRadius: 6, fontSize: 12, background: tokens.surface, color: tokens.textPrimary, fontFamily: 'inherit' },
  clearBtn: { background: 'transparent', border: `1px solid ${tokens.border}`, padding: '5px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: tokens.textSecondary },
  summary: { fontSize: 13, color: tokens.textPrimary, marginBottom: 12 },
  empty: { padding: 24, textAlign: 'center', color: tokens.textTertiary, fontSize: 13 },
  error: { background: tokens.errorBg, color: tokens.errorText, padding: 8, borderRadius: 6, fontSize: 13, marginBottom: 8 },
  tableWrap: { display: 'flex', flexDirection: 'column' },
  tableHead: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, color: tokens.textTertiary, borderBottom: `1px solid ${tokens.border}`, marginBottom: 4 },
  row: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: `1px solid ${tokens.surfaceMuted}` },
  iconBtn: { background: 'transparent', border: 0, padding: 4, cursor: 'pointer', color: tokens.textTertiary, display: 'inline-flex' },
};
