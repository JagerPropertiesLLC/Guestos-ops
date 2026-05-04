'use client';

// components/construction/ChangeOrdersSection.js
// Project change orders. Negative amounts (credit COs) render in red.

import { useEffect, useState, useCallback } from 'react';
import { Plus, ClipboardEdit, Pencil, Trash2, Loader2 } from 'lucide-react';
import { tokens } from './_tokens';
import StatusPill from './StatusPill';
import ChangeOrderModal from './ChangeOrderModal';

export default function ChangeOrdersSection({ projectId }) {
  const [cos, setCos]           = useState([]);
  const [phases, setPhases]     = useState([]);
  const [subs, setSubs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [editing, setEditing]   = useState(null);

  const loadAdjacent = useCallback(async () => {
    try {
      const [pRes, sRes] = await Promise.all([
        fetch(`/api/construction/projects/${projectId}/phases`),
        fetch(`/api/construction/projects/${projectId}/subcontracts`),
      ]);
      const pj = await pRes.json();
      const sj = await sRes.json();
      setPhases(pj.phases || []);
      setSubs(sj.subcontracts || []);
    } catch (_) { /* non-fatal */ }
  }, [projectId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/construction/projects/${projectId}/change-orders`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setCos(j.change_orders || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { loadAdjacent(); }, [loadAdjacent]);
  useEffect(() => { load(); }, [load]);

  function handleSaved() { setEditing(null); load(); }

  async function handleDelete(id) {
    if (!confirm('Delete this change order?')) return;
    try {
      const r = await fetch(`/api/construction/projects/${projectId}/change-orders/${id}`, { method: 'DELETE' });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${r.status}`);
      }
      setCos(cos.filter(c => c.id !== id));
    } catch (e) {
      setError(e.message);
    }
  }

  const totalApproved = cos.filter(c => c.status === 'approved').reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const totalPending  = cos.filter(c => c.status === 'pending' ).reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const pendingCount  = cos.filter(c => c.status === 'pending' ).length;

  return (
    <section style={s.card}>
      <header style={s.head}>
        <ClipboardEdit size={18} style={{ color: tokens.textTertiary }} />
        <h2 style={s.title}>Change orders</h2>
        <span style={s.count}>{cos.length}</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => setEditing({})} style={s.addBtn}>
          <Plus size={12} />
          <span>New CO</span>
        </button>
      </header>

      {error && <div style={s.error}>{error}</div>}

      {loading ? (
        <div style={s.empty}><Loader2 size={14} style={{ animation: 'spin 1s linear infinite', marginRight: 6 }} />Loading…</div>
      ) : cos.length === 0 ? (
        <div style={s.empty}>No change orders yet. Add CO-001 to track scope or cost adjustments.</div>
      ) : (
        <>
          <div style={s.totals}>
            <Stat label="Approved net" value={fmtSigned(totalApproved)} red={totalApproved < 0} />
            <Stat label="Pending net"  value={fmtSigned(totalPending)} subtle />
            <Stat label="Pending COs"  value={pendingCount} highlight={pendingCount > 0} />
          </div>

          <div style={s.tableWrap}>
            <div style={s.tableHead}>
              <div style={{ width: 80 }}>CO #</div>
              <div style={{ flex: 2 }}>Description</div>
              <div style={{ width: 130 }}>Subcontract</div>
              <div style={{ width: 100, textAlign: 'right' }}>Amount</div>
              <div style={{ width: 60,  textAlign: 'right' }}>Days</div>
              <div style={{ width: 110 }}>Status</div>
              <div style={{ width: 70,  textAlign: 'right' }}>Actions</div>
            </div>
            {cos.map(co => (
              <div key={co.id} style={s.row}>
                <div style={{ width: 80, fontSize: 12, fontWeight: 600, color: tokens.textPrimary }}>{co.co_number || '—'}</div>
                <div style={{ flex: 2, fontSize: 13, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {co.description}
                </div>
                <div style={{ width: 130, fontSize: 12, color: co.subcontract ? tokens.textSecondary : tokens.textTertiary, fontStyle: co.subcontract ? 'normal' : 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {co.subcontract?.scope?.slice(0, 20) || (co.subcontract?.company?.name) || 'project-wide'}
                </div>
                <div style={{ width: 100, textAlign: 'right', fontSize: 13, fontWeight: 600, color: Number(co.amount) < 0 ? tokens.errorText : tokens.textPrimary }}>
                  {fmtSigned(co.amount)}
                </div>
                <div style={{ width: 60, textAlign: 'right', fontSize: 12, color: tokens.textSecondary }}>
                  {co.schedule_impact_days ? (co.schedule_impact_days > 0 ? `+${co.schedule_impact_days}` : co.schedule_impact_days) : '—'}
                </div>
                <div style={{ width: 110 }}><StatusPill status={co.status} /></div>
                <div style={{ width: 70, textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                  <button onClick={() => setEditing(co)} style={s.iconBtn} title="Edit"><Pencil size={14} /></button>
                  <button onClick={() => handleDelete(co.id)} style={{ ...s.iconBtn, color: tokens.errorText }} title="Delete"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {editing !== null && (
        <ChangeOrderModal
          projectId={projectId}
          changeOrder={editing}
          phases={phases}
          subcontracts={subs}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}

function Stat({ label, value, subtle, red, highlight }) {
  return (
    <div style={s.stat}>
      <div style={s.statLabel}>{label}</div>
      <div style={{
        ...s.statValue,
        ...(red       ? { color: tokens.errorText } : {}),
        ...(subtle    ? { color: tokens.textSecondary } : {}),
        ...(highlight ? { color: tokens.primary } : {}),
      }}>
        {value}
      </div>
    </div>
  );
}

function fmtSigned(n) {
  if (n == null || n === '' || isNaN(Number(n))) return '—';
  const num = Number(n);
  const formatted = Math.abs(num).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return num < 0 ? `-${formatted}` : formatted;
}

const s = {
  card: { background: tokens.surface, border: `1px solid ${tokens.border}`, borderRadius: 10, padding: 16, marginBottom: 12 },
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
  tableHead: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, color: tokens.textTertiary, borderBottom: `1px solid ${tokens.border}`, marginBottom: 4 },
  row: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: `1px solid ${tokens.surfaceMuted}` },
  iconBtn: { background: 'transparent', border: 0, padding: 4, cursor: 'pointer', color: tokens.textTertiary, display: 'inline-flex' },
};
