'use client';

// components/construction/InspectionsSection.js
// Construction inspections grid + inline SWPPP block.
//
// The new construction inspections live in `inspections` and are managed
// here. SWPPP weekly/storm inspections are a separate regime in
// `swppp_inspections` with its own /api/swppp/* routes — we just embed
// <SwpppTab> at the bottom. The SwpppTab handles its own loading + the
// "not configured" fallback.

import { useEffect, useState, useCallback } from 'react';
import { Plus, ShieldCheck, Pencil, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { tokens } from './_tokens';
import StatusPill from './StatusPill';
import InspectionModal from './InspectionModal';
import SwpppTab from '@/components/SwpppTab';

const COMMON_TYPES = [
  'Building', 'Electrical', 'Plumbing', 'Mechanical', 'Fire',
  'Framing', 'Foundation', 'Rough-in', 'Final', 'Third-party', 'Other',
];

export default function InspectionsSection({ projectId }) {
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [editing, setEditing]         = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/construction/projects/${projectId}/inspections`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setInspections(j.inspections || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  function handleSaved() { setEditing(null); load(); }

  async function handleDelete(id) {
    if (!confirm('Delete this inspection?')) return;
    try {
      const r = await fetch(`/api/construction/projects/${projectId}/inspections/${id}`, { method: 'DELETE' });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${r.status}`);
      }
      setInspections(inspections.filter(i => i.id !== id));
    } catch (e) {
      setError(e.message);
    }
  }

  const open      = inspections.filter(i => !i.completed_date).length;
  const failedOpen = inspections.filter(i => i.result === 'failed' && i.followup_required).length;

  return (
    <section style={s.card}>
      <header style={s.head}>
        <ShieldCheck size={18} style={{ color: tokens.textTertiary }} />
        <h2 style={s.title}>Inspections</h2>
        <span style={s.count}>{open} open / {inspections.length} total</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => setEditing({})} style={s.addBtn}>
          <Plus size={12} />
          <span>New inspection</span>
        </button>
      </header>

      {failedOpen > 0 && (
        <div style={s.warn}>
          <AlertTriangle size={14} />
          <span>{failedOpen} failed inspection{failedOpen === 1 ? '' : 's'} with follow-up required.</span>
        </div>
      )}

      {error && <div style={s.error}>{error}</div>}

      {loading ? (
        <div style={s.empty}><Loader2 size={14} style={{ animation: 'spin 1s linear infinite', marginRight: 6 }} />Loading…</div>
      ) : inspections.length === 0 ? (
        <div style={s.empty}>No construction inspections yet. Add building / electrical / plumbing / final inspections as they're scheduled.</div>
      ) : (
        <div style={s.tableWrap}>
          <div style={s.tableHead}>
            <div style={{ flex: 1.4 }}>Type / authority</div>
            <div style={{ width: 130 }}>Inspector</div>
            <div style={{ width: 110 }}>Scheduled</div>
            <div style={{ width: 110 }}>Completed</div>
            <div style={{ width: 130 }}>Status</div>
            <div style={{ width: 70, textAlign: 'right' }}>Actions</div>
          </div>
          {inspections.map(i => (
            <div key={i.id} style={s.row}>
              <div style={{ flex: 1.4, fontSize: 13, minWidth: 0 }}>
                <div style={{ fontWeight: 500, color: tokens.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {i.inspection_type}
                </div>
                {i.authority && (
                  <div style={{ color: tokens.textSecondary, fontSize: 12 }}>{i.authority}</div>
                )}
              </div>
              <div style={{ width: 130, fontSize: 12, color: i.inspector_name ? tokens.textPrimary : tokens.textTertiary, fontStyle: i.inspector_name ? 'normal' : 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {i.inspector_name || '—'}
              </div>
              <div style={{ width: 110, fontSize: 12, color: tokens.textSecondary }}>{i.scheduled_date || '—'}</div>
              <div style={{ width: 110, fontSize: 12, color: tokens.textSecondary }}>{i.completed_date || '—'}</div>
              <div style={{ width: 130 }}><StatusPill status={i.status} /></div>
              <div style={{ width: 70, textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                <button onClick={() => setEditing(i)} style={s.iconBtn} title="Edit"><Pencil size={14} /></button>
                <button onClick={() => handleDelete(i.id)} style={{ ...s.iconBtn, color: tokens.errorText }} title="Delete"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={s.swpppDivider}>
        <h3 style={s.swpppHeading}>SWPPP weekly inspections</h3>
        <SwpppTab projectId={projectId} />
      </div>

      {editing !== null && (
        <InspectionModal
          projectId={projectId}
          inspection={editing}
          commonTypes={COMMON_TYPES}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}

const s = {
  card: { background: tokens.surface, border: `1px solid ${tokens.border}`, borderRadius: 10, padding: 16, marginBottom: 12 },
  head: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 },
  title: { margin: 0, fontSize: 14, color: tokens.textPrimary, fontWeight: 600 },
  count: { background: tokens.surfaceMuted, color: tokens.textSecondary, padding: '1px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 },
  addBtn: { display: 'inline-flex', alignItems: 'center', gap: 4, background: tokens.primary, color: '#fff', border: 0, padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer' },
  empty: { padding: 24, textAlign: 'center', color: tokens.textTertiary, fontSize: 13 },
  error: { background: tokens.errorBg, color: tokens.errorText, padding: 8, borderRadius: 6, fontSize: 13, marginBottom: 8 },
  warn: { display: 'flex', alignItems: 'center', gap: 8, background: '#fef3c7', color: '#854d0e', padding: 10, borderRadius: 6, fontSize: 13, marginBottom: 8 },
  tableWrap: { display: 'flex', flexDirection: 'column' },
  tableHead: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, color: tokens.textTertiary, borderBottom: `1px solid ${tokens.border}`, marginBottom: 4 },
  row: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: `1px solid ${tokens.surfaceMuted}` },
  iconBtn: { background: 'transparent', border: 0, padding: 4, cursor: 'pointer', color: tokens.textTertiary, display: 'inline-flex' },
  swpppDivider: {
    marginTop: 24, paddingTop: 20,
    borderTop: `1px dashed ${tokens.border}`,
  },
  swpppHeading: {
    margin: '0 0 12px', fontSize: 13, color: tokens.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600,
  },
};
