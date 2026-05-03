'use client';

// components/construction/PhasesSection.js
// Live phases editor: list, add, edit-on-blur, reorder (up/down), delete.

import { useEffect, useState, useCallback } from 'react';
import { Plus, ChevronUp, ChevronDown, Trash2, Layers, Loader2 } from 'lucide-react';
import { tokens, PHASE_STATUS_OPTIONS } from './_tokens';

export default function PhasesSection({ projectId }) {
  const [phases, setPhases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);
  const [reordering, setReordering] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/construction/projects/${projectId}/phases`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setPhases(j.phases || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  async function addPhase() {
    setAdding(true);
    try {
      const r = await fetch(`/api/construction/projects/${projectId}/phases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New phase', status: 'not_started' }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setPhases([...phases, { ...j.phase, spent: 0 }]);
    } catch (e) {
      setError(e.message);
    } finally {
      setAdding(false);
    }
  }

  async function deletePhase(id) {
    if (!confirm('Delete this phase? Expenses tagged to it will become untagged.')) return;
    try {
      const r = await fetch(`/api/construction/projects/${projectId}/phases/${id}`, { method: 'DELETE' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setPhases(phases.filter(p => p.id !== id));
    } catch (e) {
      setError(e.message);
    }
  }

  async function move(idx, dir) {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= phases.length) return;
    const next = [...phases];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    setPhases(next);
    setReordering(true);
    try {
      const r = await fetch(`/api/construction/projects/${projectId}/phases/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phaseIds: next.map(p => p.id) }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${r.status}`);
      }
    } catch (e) {
      setError(e.message);
      load();
    } finally {
      setReordering(false);
    }
  }

  async function patch(id, partial) {
    try {
      const r = await fetch(`/api/construction/projects/${projectId}/phases/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setPhases(phases.map(p => p.id === id ? { ...p, ...j.phase } : p));
    } catch (e) {
      setError(e.message);
      load();
    }
  }

  return (
    <section style={s.card}>
      <header style={s.head}>
        <Layers size={18} style={{ color: tokens.textTertiary }} />
        <h2 style={s.title}>Phases</h2>
        <span style={s.count}>{phases.length}</span>
        {reordering && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: tokens.textTertiary }} />}
        <div style={{ flex: 1 }} />
        <button onClick={addPhase} disabled={adding} style={s.addBtn}>
          {adding ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={12} />}
          <span>Add phase</span>
        </button>
      </header>
      {error && <div style={s.error}>{error}</div>}
      {loading ? (
        <div style={s.empty}>Loading…</div>
      ) : phases.length === 0 ? (
        <div style={s.empty}>No phases yet. Add the first phase to start sequencing the build.</div>
      ) : (
        <div style={s.tableWrap}>
          <div style={s.tableHead}>
            <div style={{ width: 24 }} />
            <div style={{ flex: 2 }}>Name</div>
            <div style={{ width: 130 }}>Status</div>
            <div style={{ width: 130 }}>Planned start</div>
            <div style={{ width: 130 }}>Planned end</div>
            <div style={{ width: 130, textAlign: 'right' }}>Budget</div>
            <div style={{ width: 130, textAlign: 'right' }}>Spent (paid)</div>
            <div style={{ width: 60 }} />
          </div>
          {phases.map((p, idx) => (
            <PhaseRow
              key={p.id}
              phase={p}
              idx={idx}
              count={phases.length}
              onMove={move}
              onDelete={() => deletePhase(p.id)}
              onPatch={(partial) => patch(p.id, partial)}
            />
          ))}
        </div>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}

function PhaseRow({ phase, idx, count, onMove, onDelete, onPatch }) {
  const [name, setName] = useState(phase.name || '');
  const [budget, setBudget] = useState(phase.budgeted_amount ?? 0);
  const [pStart, setPStart] = useState(phase.planned_start || '');
  const [pEnd, setPEnd] = useState(phase.planned_end || '');

  useEffect(() => { setName(phase.name || ''); }, [phase.name]);
  useEffect(() => { setBudget(phase.budgeted_amount ?? 0); }, [phase.budgeted_amount]);
  useEffect(() => { setPStart(phase.planned_start || ''); }, [phase.planned_start]);
  useEffect(() => { setPEnd(phase.planned_end || ''); }, [phase.planned_end]);

  return (
    <div style={s.row}>
      <div style={{ width: 24, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <button disabled={idx === 0} onClick={() => onMove(idx, -1)} style={s.iconBtn} title="Move up">
          <ChevronUp size={14} />
        </button>
        <button disabled={idx === count - 1} onClick={() => onMove(idx, 1)} style={s.iconBtn} title="Move down">
          <ChevronDown size={14} />
        </button>
      </div>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name !== phase.name && onPatch({ name })}
        style={{ ...s.input, flex: 2 }}
      />
      <select
        value={phase.status || 'not_started'}
        onChange={(e) => onPatch({ status: e.target.value })}
        style={{ ...s.input, width: 130 }}
      >
        {PHASE_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <input
        type="date"
        value={pStart}
        onChange={(e) => setPStart(e.target.value)}
        onBlur={() => (pStart || null) !== (phase.planned_start || null) && onPatch({ planned_start: pStart || null })}
        style={{ ...s.input, width: 130 }}
      />
      <input
        type="date"
        value={pEnd}
        onChange={(e) => setPEnd(e.target.value)}
        onBlur={() => (pEnd || null) !== (phase.planned_end || null) && onPatch({ planned_end: pEnd || null })}
        style={{ ...s.input, width: 130 }}
      />
      <input
        type="number"
        step="any"
        min="0"
        value={budget}
        onChange={(e) => setBudget(e.target.value)}
        onBlur={() => Number(budget) !== Number(phase.budgeted_amount) && onPatch({ budgeted_amount: Number(budget) })}
        style={{ ...s.input, width: 130, textAlign: 'right' }}
      />
      <div style={{ width: 130, textAlign: 'right', fontSize: 13, color: tokens.textSecondary, paddingRight: 8 }}>
        {fmt(phase.spent || 0)}
      </div>
      <div style={{ width: 60, textAlign: 'right' }}>
        <button onClick={onDelete} style={{ ...s.iconBtn, color: tokens.errorText }} title="Delete phase">
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
  tableWrap: { display: 'flex', flexDirection: 'column', gap: 4 },
  tableHead: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '4px 0', fontSize: 11, fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: 0.4,
    color: tokens.textTertiary,
    borderBottom: `1px solid ${tokens.border}`, marginBottom: 4,
  },
  row: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '4px 0',
  },
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
