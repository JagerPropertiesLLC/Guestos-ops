'use client';

// components/construction/ExpensesSection.js
// Live expense ledger with filters (phase / category / paid status / vendor)
// + add/edit modal. Reloads phases & categories so the modal can tag them.

import { useEffect, useState, useCallback } from 'react';
import { Plus, Receipt, Pencil, Trash2, ExternalLink, Loader2 } from 'lucide-react';
import { tokens, EXPENSE_PAID_STATUS_OPTIONS } from './_tokens';
import StatusPill from './StatusPill';
import ExpenseModal from './ExpenseModal';

export default function ExpensesSection({ projectId }) {
  const [expenses, setExpenses] = useState([]);
  const [phases, setPhases] = useState([]);
  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [filters, setFilters] = useState({ phase_id: '', budget_category_id: '', paid_status: '', vendor_company_id: '' });

  const loadFilters = useCallback(async () => {
    try {
      const [pRes, cRes] = await Promise.all([
        fetch(`/api/construction/projects/${projectId}/phases`),
        fetch(`/api/construction/projects/${projectId}/budget-categories`),
      ]);
      const pj = await pRes.json();
      const cj = await cRes.json();
      setPhases(pj.phases || []);
      setCategories(cj.categories || []);
    } catch (e) {
      // non-fatal — modal still works without dropdowns populated
    }
  }, [projectId]);

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(filters)) {
        if (v) params.set(k, v);
      }
      const r = await fetch(`/api/construction/projects/${projectId}/expenses${params.toString() ? '?' + params : ''}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setExpenses(j.expenses || []);
      // Build distinct vendor list from results for the vendor filter dropdown
      const seen = new Map();
      for (const e of (j.expenses || [])) {
        if (e.vendor && !seen.has(e.vendor.id)) seen.set(e.vendor.id, e.vendor);
      }
      setVendors(Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [projectId, filters]);

  useEffect(() => { loadFilters(); }, [loadFilters]);
  useEffect(() => { loadExpenses(); }, [loadExpenses]);

  async function handleSaved(/* expense */) {
    setEditing(null);
    await loadExpenses();
    // reload categories so spent rollups refresh in case BudgetSection isn't re-mounted yet
    loadFilters();
  }

  async function handleDelete(id) {
    if (!confirm('Delete this expense?')) return;
    try {
      const r = await fetch(`/api/construction/projects/${projectId}/expenses/${id}`, { method: 'DELETE' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setExpenses(expenses.filter(e => e.id !== id));
    } catch (e) {
      setError(e.message);
    }
  }

  const total = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const paidTotal = expenses.filter(e => e.paid_status === 'paid').reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const filtersActive = Object.values(filters).some(Boolean);

  return (
    <section style={s.card}>
      <header style={s.head}>
        <Receipt size={18} style={{ color: tokens.textTertiary }} />
        <h2 style={s.title}>Expenses</h2>
        <span style={s.count}>{expenses.length}</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => setEditing({})} style={s.addBtn}>
          <Plus size={12} />
          <span>New expense</span>
        </button>
      </header>

      <div style={s.filters}>
        <FilterSelect label="Phase" value={filters.phase_id} onChange={(v) => setFilters({ ...filters, phase_id: v })} options={[
          { value: '', label: 'All phases' },
          { value: 'null', label: '— untagged —' },
          ...phases.map(p => ({ value: p.id, label: p.name })),
        ]} />
        <FilterSelect label="Category" value={filters.budget_category_id} onChange={(v) => setFilters({ ...filters, budget_category_id: v })} options={[
          { value: '', label: 'All categories' },
          { value: 'null', label: '— untagged —' },
          ...categories.map(c => ({ value: c.id, label: c.name })),
        ]} />
        <FilterSelect label="Paid status" value={filters.paid_status} onChange={(v) => setFilters({ ...filters, paid_status: v })} options={[
          { value: '', label: 'All statuses' },
          ...EXPENSE_PAID_STATUS_OPTIONS,
        ]} />
        <FilterSelect label="Vendor" value={filters.vendor_company_id} onChange={(v) => setFilters({ ...filters, vendor_company_id: v })} options={[
          { value: '', label: 'All vendors' },
          { value: 'null', label: '— no vendor —' },
          ...vendors.map(v => ({ value: v.id, label: v.name })),
        ]} />
        {filtersActive && (
          <button onClick={() => setFilters({ phase_id: '', budget_category_id: '', paid_status: '', vendor_company_id: '' })} style={s.clearBtn}>Clear</button>
        )}
      </div>

      <div style={s.summary}>
        <span><strong>{fmt(total)}</strong> total ({expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'})</span>
        <span style={{ color: tokens.textSecondary }}> · {fmt(paidTotal)} paid · {fmt(total - paidTotal)} not paid</span>
      </div>

      {error && <div style={s.error}>{error}</div>}

      {loading ? (
        <div style={s.empty}><Loader2 size={14} style={{ animation: 'spin 1s linear infinite', marginRight: 6 }} />Loading…</div>
      ) : expenses.length === 0 ? (
        <div style={s.empty}>{filtersActive ? 'No expenses match those filters.' : 'No expenses yet. Click "New expense" to log the first one.'}</div>
      ) : (
        <div style={s.tableWrap}>
          <div style={s.tableHead}>
            <div style={{ width: 100 }}>Date</div>
            <div style={{ flex: 1.4 }}>Vendor / desc</div>
            <div style={{ width: 130 }}>Phase</div>
            <div style={{ width: 130 }}>Category</div>
            <div style={{ width: 100, textAlign: 'right' }}>Amount</div>
            <div style={{ width: 100 }}>Status</div>
            <div style={{ width: 80, textAlign: 'right' }}>Actions</div>
          </div>
          {expenses.map(e => (
            <div key={e.id} style={s.row}>
              <div style={{ width: 100, fontSize: 13 }}>{e.expense_date}</div>
              <div style={{ flex: 1.4, fontSize: 13, minWidth: 0 }}>
                <div style={{ fontWeight: 500, color: tokens.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.vendor?.name || <span style={{ color: tokens.textTertiary, fontStyle: 'italic' }}>no vendor</span>}
                </div>
                {e.description && <div style={{ color: tokens.textSecondary, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description}</div>}
              </div>
              <div style={{ width: 130, fontSize: 12, color: e.phase ? tokens.textPrimary : tokens.textTertiary, fontStyle: e.phase ? 'normal' : 'italic' }}>
                {e.phase?.name || 'untagged'}
              </div>
              <div style={{ width: 130, fontSize: 12, color: e.category ? tokens.textPrimary : tokens.textTertiary, fontStyle: e.category ? 'normal' : 'italic' }}>
                {e.category?.name || 'untagged'}
              </div>
              <div style={{ width: 100, textAlign: 'right', fontSize: 13, fontWeight: 600, color: tokens.textPrimary }}>
                {fmt(e.amount)}
              </div>
              <div style={{ width: 100 }}>
                <StatusPill status={e.paid_status} />
              </div>
              <div style={{ width: 80, textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                {e.receipt_url && (
                  <a href={e.receipt_url} target="_blank" rel="noopener noreferrer" style={s.iconBtn} title="Open receipt">
                    <ExternalLink size={14} />
                  </a>
                )}
                <button onClick={() => setEditing(e)} style={s.iconBtn} title="Edit">
                  <Pencil size={14} />
                </button>
                <button onClick={() => handleDelete(e.id)} style={{ ...s.iconBtn, color: tokens.errorText }} title="Delete">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing !== null && (
        <ExpenseModal
          projectId={projectId}
          expense={editing}
          phases={phases}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={s.filterSelect} aria-label={label}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
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
  filters: {
    display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8,
  },
  filterSelect: {
    padding: '5px 8px', border: `1px solid ${tokens.border}`,
    borderRadius: 6, fontSize: 12, background: tokens.surface, color: tokens.textPrimary,
    fontFamily: 'inherit',
  },
  clearBtn: {
    background: 'transparent', border: `1px solid ${tokens.border}`,
    padding: '5px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
    color: tokens.textSecondary,
  },
  summary: { fontSize: 13, color: tokens.textPrimary, marginBottom: 12 },
  empty: { padding: 24, textAlign: 'center', color: tokens.textTertiary, fontSize: 13 },
  error: { background: tokens.errorBg, color: tokens.errorText, padding: 8, borderRadius: 6, fontSize: 13, marginBottom: 8 },
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
    padding: '8px 0',
    borderBottom: `1px solid ${tokens.surfaceMuted}`,
  },
  iconBtn: {
    background: 'transparent', border: 0, padding: 4, cursor: 'pointer',
    color: tokens.textTertiary, display: 'inline-flex',
  },
};
