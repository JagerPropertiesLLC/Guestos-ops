'use client';

// components/construction/BudgetSection.js
// Live budget categories with rollup (budgeted vs spent vs remaining).

import { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, Banknote, Loader2 } from 'lucide-react';
import { tokens } from './_tokens';

export default function BudgetSection({ projectId }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/construction/projects/${projectId}/budget-categories`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setCategories(j.categories || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  async function addCategory() {
    setAdding(true);
    try {
      const r = await fetch(`/api/construction/projects/${projectId}/budget-categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New category', budgeted_amount: 0 }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setCategories([...categories, { ...j.category, spent_paid: 0, spent_unpaid: 0, remaining: Number(j.category.budgeted_amount || 0), pct_spent: null }]);
    } catch (e) {
      setError(e.message);
    } finally {
      setAdding(false);
    }
  }

  async function deleteCategory(id) {
    if (!confirm('Delete this category? Expenses tagged to it will become untagged.')) return;
    try {
      const r = await fetch(`/api/construction/projects/${projectId}/budget-categories/${id}`, { method: 'DELETE' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setCategories(categories.filter(c => c.id !== id));
    } catch (e) {
      setError(e.message);
    }
  }

  async function patch(id, partial) {
    try {
      const r = await fetch(`/api/construction/projects/${projectId}/budget-categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setCategories(categories.map(c => c.id === id ? { ...c, ...j.category, spent_paid: c.spent_paid, spent_unpaid: c.spent_unpaid, remaining: Number(j.category.budgeted_amount || 0) - (c.spent_paid || 0), pct_spent: Number(j.category.budgeted_amount || 0) > 0 ? Math.round((c.spent_paid || 0) / Number(j.category.budgeted_amount) * 1000) / 10 : null } : c));
    } catch (e) {
      setError(e.message);
      load();
    }
  }

  const totalBudgeted = categories.reduce((sum, c) => sum + Number(c.budgeted_amount || 0), 0);
  const totalSpentPaid = categories.reduce((sum, c) => sum + Number(c.spent_paid || 0), 0);
  const totalSpentUnpaid = categories.reduce((sum, c) => sum + Number(c.spent_unpaid || 0), 0);
  const totalRemaining = totalBudgeted - totalSpentPaid;

  return (
    <section style={s.card}>
      <header style={s.head}>
        <Banknote size={18} style={{ color: tokens.textTertiary }} />
        <h2 style={s.title}>Budget</h2>
        <span style={s.count}>{categories.length} categor{categories.length === 1 ? 'y' : 'ies'}</span>
        <div style={{ flex: 1 }} />
        <button onClick={addCategory} disabled={adding} style={s.addBtn}>
          {adding ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={12} />}
          <span>Add category</span>
        </button>
      </header>
      {error && <div style={s.error}>{error}</div>}

      {loading ? (
        <div style={s.empty}>Loading…</div>
      ) : categories.length === 0 ? (
        <div style={s.empty}>No budget categories yet. Add categories like &quot;Site work&quot;, &quot;Foundation&quot;, &quot;Framing&quot; to break down the budget.</div>
      ) : (
        <>
          <div style={s.totals}>
            <Stat label="Total budgeted" value={fmt(totalBudgeted)} />
            <Stat label="Spent (paid)" value={fmt(totalSpentPaid)} />
            <Stat label="Committed (unpaid)" value={fmt(totalSpentUnpaid)} subtle />
            <Stat label="Remaining" value={fmt(totalRemaining)} red={totalRemaining < 0} />
          </div>

          <div style={s.tableWrap}>
            <div style={s.tableHead}>
              <div style={{ flex: 2 }}>Category</div>
              <div style={{ width: 140, textAlign: 'right' }}>Budgeted</div>
              <div style={{ width: 140, textAlign: 'right' }}>Spent (paid)</div>
              <div style={{ width: 140, textAlign: 'right' }}>Remaining</div>
              <div style={{ width: 80, textAlign: 'right' }}>% Used</div>
              <div style={{ width: 60 }} />
            </div>
            {categories.map(c => (
              <CategoryRow
                key={c.id}
                cat={c}
                onPatch={(partial) => patch(c.id, partial)}
                onDelete={() => deleteCategory(c.id)}
              />
            ))}
          </div>
        </>
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

function CategoryRow({ cat, onPatch, onDelete }) {
  const [name, setName] = useState(cat.name || '');
  const [budget, setBudget] = useState(cat.budgeted_amount ?? 0);

  useEffect(() => { setName(cat.name || ''); }, [cat.name]);
  useEffect(() => { setBudget(cat.budgeted_amount ?? 0); }, [cat.budgeted_amount]);

  const over = cat.pct_spent != null && cat.pct_spent > 100;
  return (
    <div style={s.row}>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name !== cat.name && onPatch({ name })}
        style={{ ...s.input, flex: 2 }}
      />
      <input
        type="number"
        step="any"
        min="0"
        value={budget}
        onChange={(e) => setBudget(e.target.value)}
        onBlur={() => Number(budget) !== Number(cat.budgeted_amount) && onPatch({ budgeted_amount: Number(budget) })}
        style={{ ...s.input, width: 140, textAlign: 'right' }}
      />
      <div style={{ ...s.cell, width: 140, textAlign: 'right' }}>{fmt(cat.spent_paid)}</div>
      <div style={{ ...s.cell, width: 140, textAlign: 'right', color: cat.remaining < 0 ? tokens.errorText : tokens.textPrimary }}>
        {fmt(cat.remaining)}
      </div>
      <div style={{ ...s.cell, width: 80, textAlign: 'right', color: over ? tokens.errorText : tokens.textSecondary, fontWeight: over ? 600 : 400 }}>
        {cat.pct_spent == null ? '—' : `${cat.pct_spent}%`}
      </div>
      <div style={{ width: 60, textAlign: 'right' }}>
        <button onClick={onDelete} style={{ ...s.iconBtn, color: tokens.errorText }} title="Delete category">
          <Trash2 size={14} />
        </button>
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
  tableWrap: { display: 'flex', flexDirection: 'column', gap: 4 },
  tableHead: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '4px 0', fontSize: 11, fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: 0.4,
    color: tokens.textTertiary,
    borderBottom: `1px solid ${tokens.border}`, marginBottom: 4,
  },
  row: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' },
  cell: { fontSize: 13, padding: '6px 8px' },
  input: {
    padding: '6px 8px',
    border: `1px solid ${tokens.border}`, borderRadius: 4,
    fontSize: 13, background: tokens.surface, color: tokens.textPrimary,
    fontFamily: 'inherit',
  },
  iconBtn: {
    background: 'transparent', border: 0, padding: 2, cursor: 'pointer',
    color: tokens.textTertiary, display: 'inline-flex',
  },
};
