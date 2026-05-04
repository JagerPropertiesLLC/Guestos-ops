'use client';

// components/construction/TasksSection.js
// Project tasks list with filters (status / phase / subcontract) + create.
// Inline status edit on each row; modal for full edit.

import { useEffect, useState, useCallback } from 'react';
import { Plus, ListTodo, Pencil, Trash2, Loader2 } from 'lucide-react';
import { tokens } from './_tokens';
import StatusPill from './StatusPill';
import TaskModal from './TaskModal';

const STATUS_OPTIONS = [
  { value: 'pending',     label: 'Pending' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed',   label: 'Completed' },
  { value: 'cancelled',   label: 'Cancelled' },
];

const PRIORITY_LABELS = { low: 'Low', medium: 'Med', high: 'High', urgent: 'Urgent' };
const PRIORITY_COLORS = {
  low:    { bg: '#f1f5f9', fg: '#475569' },
  medium: { bg: '#dbeafe', fg: '#1e40af' },
  high:   { bg: '#fef3c7', fg: '#854d0e' },
  urgent: { bg: '#fee2e2', fg: '#991b1b' },
};

export default function TasksSection({ projectId }) {
  const [tasks, setTasks]       = useState([]);
  const [phases, setPhases]     = useState([]);
  const [subs, setSubs]         = useState([]);
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [editing, setEditing]   = useState(null);
  const [filters, setFilters]   = useState({ status: '', phase_id: '', subcontract_id: '' });

  const loadAdjacent = useCallback(async () => {
    try {
      const [pRes, sRes, uRes] = await Promise.all([
        fetch(`/api/construction/projects/${projectId}/phases`),
        fetch(`/api/construction/projects/${projectId}/subcontracts`),
        fetch('/api/construction/lookups').catch(() => null),
      ]);
      const pj = await pRes.json();
      const sj = await sRes.json();
      setPhases(pj.phases || []);
      setSubs(sj.subcontracts || []);
      if (uRes && uRes.ok) {
        const uj = await uRes.json();
        setUsers(uj.app_users || uj.users || []);
      }
    } catch (_) { /* non-fatal */ }
  }, [projectId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
      const r = await fetch(`/api/construction/projects/${projectId}/tasks${params.toString() ? '?' + params : ''}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setTasks(j.tasks || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [projectId, filters]);

  useEffect(() => { loadAdjacent(); }, [loadAdjacent]);
  useEffect(() => { load(); }, [load]);

  function handleSaved() { setEditing(null); load(); }

  async function handleStatusChange(id, newStatus) {
    try {
      const r = await fetch(`/api/construction/projects/${projectId}/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setTasks(tasks.map(t => t.id === id ? { ...t, ...j.task } : t));
    } catch (e) {
      setError(e.message);
      load();
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this task?')) return;
    try {
      const r = await fetch(`/api/construction/projects/${projectId}/tasks/${id}`, { method: 'DELETE' });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${r.status}`);
      }
      setTasks(tasks.filter(t => t.id !== id));
    } catch (e) {
      setError(e.message);
    }
  }

  const open = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length;
  const filtersActive = Object.values(filters).some(Boolean);

  return (
    <section style={s.card}>
      <header style={s.head}>
        <ListTodo size={18} style={{ color: tokens.textTertiary }} />
        <h2 style={s.title}>Tasks</h2>
        <span style={s.count}>{open} open / {tasks.length} total</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => setEditing({})} style={s.addBtn}>
          <Plus size={12} />
          <span>New task</span>
        </button>
      </header>

      <div style={s.filters}>
        <FilterSelect value={filters.status} onChange={(v) => setFilters({ ...filters, status: v })} options={[
          { value: '', label: 'All statuses' },
          ...STATUS_OPTIONS,
        ]} />
        <FilterSelect value={filters.phase_id} onChange={(v) => setFilters({ ...filters, phase_id: v })} options={[
          { value: '', label: 'All phases' },
          { value: 'null', label: '— no phase —' },
          ...phases.map(p => ({ value: p.id, label: p.name })),
        ]} />
        <FilterSelect value={filters.subcontract_id} onChange={(v) => setFilters({ ...filters, subcontract_id: v })} options={[
          { value: '', label: 'All subcontracts' },
          { value: 'null', label: '— no sub —' },
          ...subs.map(sub => ({ value: sub.id, label: `${sub.vendor_name || sub.vendor?.name || '(no vendor)'} — ${(sub.scope || '').slice(0, 30)}` })),
        ]} />
        {filtersActive && (
          <button onClick={() => setFilters({ status: '', phase_id: '', subcontract_id: '' })} style={s.clearBtn}>Clear</button>
        )}
      </div>

      {error && <div style={s.error}>{error}</div>}

      {loading ? (
        <div style={s.empty}><Loader2 size={14} style={{ animation: 'spin 1s linear infinite', marginRight: 6 }} />Loading…</div>
      ) : tasks.length === 0 ? (
        <div style={s.empty}>{filtersActive ? 'No tasks match those filters.' : 'No tasks yet. Click "New task" to add the first one.'}</div>
      ) : (
        <div style={s.tableWrap}>
          <div style={s.tableHead}>
            <div style={{ flex: 2 }}>Title</div>
            <div style={{ width: 130 }}>Status</div>
            <div style={{ width: 70 }}>Priority</div>
            <div style={{ width: 100 }}>Due</div>
            <div style={{ width: 130 }}>Phase / Sub</div>
            <div style={{ width: 130 }}>Assignee</div>
            <div style={{ width: 70, textAlign: 'right' }}>Actions</div>
          </div>
          {tasks.map(t => {
            const pri = PRIORITY_COLORS[t.priority] || PRIORITY_COLORS.medium;
            return (
              <div key={t.id} style={s.row}>
                <div style={{ flex: 2, fontSize: 13, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, color: tokens.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.title}
                  </div>
                  {t.description && (
                    <div style={{ color: tokens.textSecondary, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.description}
                    </div>
                  )}
                </div>
                <div style={{ width: 130 }}>
                  <select value={t.status || 'pending'} onChange={(e) => handleStatusChange(t.id, e.target.value)} style={s.statusSelect}>
                    {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div style={{ width: 70 }}>
                  <span style={{ ...s.priorityPill, background: pri.bg, color: pri.fg }}>
                    {PRIORITY_LABELS[t.priority] || t.priority}
                  </span>
                </div>
                <div style={{ width: 100, fontSize: 12, color: tokens.textSecondary }}>{t.due_date || '—'}</div>
                <div style={{ width: 130, fontSize: 12, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.phase?.name && <span style={{ color: tokens.textPrimary }}>{t.phase.name}</span>}
                  {t.subcontract?.scope && <span style={{ color: tokens.textSecondary, fontSize: 11 }}> · {t.subcontract.scope.slice(0, 20)}</span>}
                  {!t.phase?.name && !t.subcontract?.scope && <span style={{ color: tokens.textTertiary, fontStyle: 'italic' }}>—</span>}
                </div>
                <div style={{ width: 130, fontSize: 12, color: t.assignee?.full_name ? tokens.textPrimary : tokens.textTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.assignee?.full_name || (t.assignee?.email) || '—'}
                </div>
                <div style={{ width: 70, textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                  <button onClick={() => setEditing({ ...t, _phases: phases, _subs: subs, _users: users })} style={s.iconBtn} title="Edit"><Pencil size={14} /></button>
                  <button onClick={() => handleDelete(t.id)} style={{ ...s.iconBtn, color: tokens.errorText }} title="Delete"><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing !== null && (
        <TaskModal
          projectId={projectId}
          task={editing}
          phases={phases}
          subcontracts={subs}
          users={users}
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

const s = {
  card: { background: tokens.surface, border: `1px solid ${tokens.border}`, borderRadius: 10, padding: 16, marginBottom: 12 },
  head: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 },
  title: { margin: 0, fontSize: 14, color: tokens.textPrimary, fontWeight: 600 },
  count: { background: tokens.surfaceMuted, color: tokens.textSecondary, padding: '1px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 },
  addBtn: { display: 'inline-flex', alignItems: 'center', gap: 4, background: tokens.primary, color: '#fff', border: 0, padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer' },
  filters: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  filterSelect: { padding: '5px 8px', border: `1px solid ${tokens.border}`, borderRadius: 6, fontSize: 12, background: tokens.surface, color: tokens.textPrimary, fontFamily: 'inherit' },
  clearBtn: { background: 'transparent', border: `1px solid ${tokens.border}`, padding: '5px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: tokens.textSecondary },
  empty: { padding: 24, textAlign: 'center', color: tokens.textTertiary, fontSize: 13 },
  error: { background: tokens.errorBg, color: tokens.errorText, padding: 8, borderRadius: 6, fontSize: 13, marginBottom: 8 },
  tableWrap: { display: 'flex', flexDirection: 'column' },
  tableHead: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, color: tokens.textTertiary, borderBottom: `1px solid ${tokens.border}`, marginBottom: 4 },
  row: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: `1px solid ${tokens.surfaceMuted}` },
  statusSelect: { padding: '4px 6px', border: `1px solid ${tokens.border}`, borderRadius: 4, fontSize: 12, background: tokens.surface, color: tokens.textPrimary, fontFamily: 'inherit', width: '100%' },
  priorityPill: { padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 },
  iconBtn: { background: 'transparent', border: 0, padding: 4, cursor: 'pointer', color: tokens.textTertiary, display: 'inline-flex' },
};
