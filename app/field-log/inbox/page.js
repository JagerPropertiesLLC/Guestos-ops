// app/field-log/inbox/page.js
// Grid of untagged + partially-tagged photos. Tap to retag, multi-select to
// batch-tag. Routed history view available via ?view=routed.
'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { ChevronLeft, CheckCircle2, AlertCircle, Send } from 'lucide-react';
import QuickTagOverlay from '@/components/field-log/QuickTagOverlay';
import TargetPicker from '@/components/field-log/TargetPicker';

export default function FieldLogInboxPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40 }}>Loading…</div>}>
      <InboxBody />
    </Suspense>
  );
}

function InboxBody() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const view = searchParams.get('view') || 'inbox';

  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [editing, setEditing] = useState(null);          // single-photo retag
  const [editingTarget, setEditingTarget] = useState(null);
  const [editingUnits, setEditingUnits] = useState([]);
  const [showBatchTag, setShowBatchTag] = useState(false);
  const [batchTarget, setBatchTarget] = useState(null);
  const [batchUnits, setBatchUnits] = useState([]);
  const [routing, setRouting] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/field-log/inbox?view=${view}`);
    const j = await r.json();
    setPhotos(j.photos || []);
    setLoading(false);
  }, [view]);

  useEffect(() => { reload(); }, [reload]);

  function toggleSelect(id) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function startEdit(photo) {
    let target = null;
    if (photo.property_id) target = { kind: 'property', id: photo.property_id, name: photo.property?.short_name || 'Property' };
    else if (photo.project_id) target = { kind: 'project', id: photo.project_id, name: photo.project?.name || 'Project' };

    let units = [];
    if (target?.kind === 'property') {
      const j = await fetch(`/api/properties/${target.id}`).then(r => r.json()).catch(() => null);
      units = (j?.units || []).filter(u => u.active !== false);
    }
    setEditing(photo);
    setEditingTarget(target);
    setEditingUnits(units);
  }

  async function pickEditTarget(t) {
    setEditingTarget(t);
    if (t.kind === 'property') {
      const j = await fetch(`/api/properties/${t.id}`).then(r => r.json()).catch(() => null);
      setEditingUnits((j?.units || []).filter(u => u.active !== false));
    } else {
      setEditingUnits([]);
    }
  }

  async function submitEdit(tags) {
    if (!editing) return;
    await fetch(`/api/field-log/photos/${editing.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        property_id: tags.property_id,
        unit_id:     tags.unit_id,
        project_id:  tags.project_id,
        photo_type:  tags._skip ? null : tags.photo_type,
        note:        tags._skip ? null : tags.note
      })
    });
    setEditing(null);
    setEditingTarget(null);
    setEditingUnits([]);
    reload();
  }

  async function pickBatchTarget(t) {
    setBatchTarget(t);
    if (t.kind === 'property') {
      const j = await fetch(`/api/properties/${t.id}`).then(r => r.json()).catch(() => null);
      setBatchUnits((j?.units || []).filter(u => u.active !== false));
    } else {
      setBatchUnits([]);
    }
  }

  async function submitBatch(tags) {
    if (selected.size === 0) return;
    await fetch('/api/field-log/batch-tag', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        photo_ids: Array.from(selected),
        tags: {
          property_id: tags.property_id,
          unit_id:     tags.unit_id,
          project_id:  tags.project_id,
          photo_type:  tags._skip ? null : tags.photo_type,
          note:        tags._skip ? null : tags.note
        }
      })
    });
    setShowBatchTag(false);
    setBatchTarget(null);
    setBatchUnits([]);
    setSelected(new Set());
    reload();
  }

  async function routeAllTagged() {
    const tagged = photos.filter(p => p.resolved_status === 'tagged');
    if (tagged.length === 0) return;
    if (!confirm(`Route ${tagged.length} tagged photo${tagged.length === 1 ? '' : 's'}? Issues become tasks; progress/reference become files.`)) return;
    setRouting(true);
    for (const p of tagged) {
      try {
        await fetch(`/api/field-log/photos/${p.id}/route`, { method: 'POST' });
      } catch { /* keep going */ }
    }
    setRouting(false);
    reload();
  }

  return (
    <div style={pageWrap}>
      <Link href="/field-log" style={backLink}><ChevronLeft size={14} /> Back</Link>
      <h1 style={{ margin: '12px 0 4px', fontSize: 24 }}>{view === 'routed' ? 'Routed history' : 'Inbox'}</h1>

      <div style={tabBar}>
        <Tab active={view === 'inbox'}  onClick={() => router.push('/field-log/inbox')}>Inbox</Tab>
        <Tab active={view === 'routed'} onClick={() => router.push('/field-log/inbox?view=routed')}>Routed</Tab>
      </div>

      {view === 'inbox' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {selected.size > 0 && (
            <button onClick={() => setShowBatchTag(true)} style={btnPrimary}>
              Tag {selected.size} selected
            </button>
          )}
          {photos.some(p => p.resolved_status === 'tagged') && (
            <button onClick={routeAllTagged} disabled={routing} style={btnRoute}>
              <Send size={14} style={{ marginRight: 6 }} />
              {routing ? 'Routing…' : `Route ${photos.filter(p => p.resolved_status === 'tagged').length} tagged`}
            </button>
          )}
        </div>
      )}

      {loading && <p>Loading…</p>}
      {!loading && photos.length === 0 && (
        <div style={emptyState}>
          <p style={{ color: '#64748b' }}>
            {view === 'routed' ? 'No routed photos yet.' : 'Inbox is empty.'}
            {' '}<Link href="/field-log/capture" style={{ color: '#0f172a' }}>Capture some →</Link>
          </p>
        </div>
      )}

      <div style={grid}>
        {photos.map(p => (
          <PhotoCard
            key={p.id}
            photo={p}
            selected={selected.has(p.id)}
            onToggleSelect={view === 'inbox' ? () => toggleSelect(p.id) : null}
            onClick={view === 'inbox' ? () => startEdit(p) : null}
          />
        ))}
      </div>

      {editing && (
        <>
          {!editingTarget && (
            <div style={overlay} onClick={() => { setEditing(null); }}>
              <div onClick={(e) => e.stopPropagation()} style={pickerCard}>
                <h2 style={{ margin: 0, fontSize: 16, marginBottom: 12 }}>Pick a target</h2>
                <TargetPicker onPick={pickEditTarget} />
              </div>
            </div>
          )}
          {editingTarget && (
            <QuickTagOverlay
              target={editingTarget}
              units={editingUnits}
              initial={{
                unit_id: editing.unit_id,
                photo_type: editing.photo_type,
                note: editing.note
              }}
              onSubmit={submitEdit}
              onChangeTarget={() => setEditingTarget(null)}
              onClose={() => { setEditing(null); setEditingTarget(null); }}
              saveLabel="Save"
            />
          )}
        </>
      )}

      {showBatchTag && (
        <>
          {!batchTarget ? (
            <div style={overlay} onClick={() => setShowBatchTag(false)}>
              <div onClick={(e) => e.stopPropagation()} style={pickerCard}>
                <h2 style={{ margin: 0, fontSize: 16, marginBottom: 12 }}>Tag {selected.size} photos</h2>
                <TargetPicker onPick={pickBatchTarget} />
              </div>
            </div>
          ) : (
            <QuickTagOverlay
              target={batchTarget}
              units={batchUnits}
              initial={{}}
              onSubmit={submitBatch}
              onChangeTarget={() => setBatchTarget(null)}
              onClose={() => { setShowBatchTag(false); setBatchTarget(null); }}
              saveLabel={`Apply to ${selected.size}`}
            />
          )}
        </>
      )}
    </div>
  );
}

function PhotoCard({ photo, selected, onToggleSelect, onClick }) {
  const isTagged = photo.resolved_status === 'tagged';
  const missingBits = [];
  if (!photo.property_id && !photo.project_id) missingBits.push('target');
  if (!photo.photo_type) missingBits.push('type');

  return (
    <div style={{ ...card, ...(selected ? { outline: '3px solid #1d4ed8' } : {}) }}>
      {photo.thumbnail_url ? (
        <img src={photo.thumbnail_url} alt="" style={img} onClick={onClick} />
      ) : (
        <div style={{ ...img, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }} onClick={onClick}>?</div>
      )}
      <div style={cardBody}>
        <div style={{ fontSize: 11, color: '#94a3b8' }}>{new Date(photo.captured_at).toLocaleString()}</div>
        <div style={{ fontSize: 13, marginTop: 4 }}>
          {photo.property?.short_name || photo.project?.name || <span style={{ color: '#dc2626' }}>No target</span>}
          {photo.unit?.unit_label && <> · {photo.unit.unit_label}</>}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
          {photo.photo_type
            ? <span style={typePill(photo.photo_type)}>{photo.photo_type}</span>
            : <span style={{ ...typePill('missing'), color: '#dc2626', background: '#fee2e2' }}>no type</span>}
          {missingBits.length > 0 && photo.resolved_status !== 'routed' && (
            <span style={{ fontSize: 11, color: '#dc2626' }}>
              <AlertCircle size={11} style={{ verticalAlign: 'middle' }} /> needs {missingBits.join(' + ')}
            </span>
          )}
          {photo.resolved_status === 'routed' && (
            <span style={{ fontSize: 11, color: '#16a34a' }}>
              <CheckCircle2 size={11} style={{ verticalAlign: 'middle' }} /> routed
            </span>
          )}
        </div>
        {photo.note && <div style={{ fontSize: 12, color: '#475569', marginTop: 6, fontStyle: 'italic' }}>{photo.note}</div>}
        {photo.routed_to_task_id && (
          <Link href={`/tasks/${photo.routed_to_task_id}`} style={{ fontSize: 12, color: '#0f172a', marginTop: 4, display: 'inline-block' }}>
            View task →
          </Link>
        )}
      </div>
      {onToggleSelect && (
        <input type="checkbox" checked={selected} onChange={onToggleSelect} style={checkbox} />
      )}
    </div>
  );
}

function Tab({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      background: 'transparent', border: 0, padding: '10px 14px', cursor: 'pointer',
      borderBottom: active ? '2px solid #0f172a' : '2px solid transparent',
      fontWeight: active ? 600 : 400, color: active ? '#0f172a' : '#64748b', fontSize: 14
    }}>{children}</button>
  );
}

function typePill(type) {
  const map = {
    issue:     { bg: '#fee2e2', fg: '#b91c1c' },
    progress:  { bg: '#dbeafe', fg: '#1e40af' },
    reference: { bg: '#f1f5f9', fg: '#475569' }
  };
  const t = map[type] || { bg: '#f1f5f9', fg: '#475569' };
  return { fontSize: 11, padding: '2px 8px', background: t.bg, color: t.fg, borderRadius: 4, textTransform: 'uppercase', letterSpacing: 0.4 };
}

const pageWrap = { maxWidth: 1100, margin: '0 auto', padding: '20px 20px 60px' };
const backLink = { color: '#64748b', textDecoration: 'none', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 };
const tabBar = { display: 'flex', gap: 4, borderBottom: '1px solid #e2e8f0', marginTop: 8, marginBottom: 16 };
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 };
const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', position: 'relative' };
const img = { width: '100%', height: 160, objectFit: 'cover', cursor: 'pointer', display: 'block' };
const cardBody = { padding: 10 };
const checkbox = { position: 'absolute', top: 8, left: 8, width: 20, height: 20, cursor: 'pointer' };
const emptyState = { padding: 40, textAlign: 'center', background: '#f8fafc', borderRadius: 10, border: '1px dashed #cbd5e1' };
const overlay = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const pickerCard = { background: '#fff', borderRadius: 12, padding: 20, width: '92%', maxWidth: 500, maxHeight: '85vh', overflow: 'auto' };
const btnPrimary = { background: '#0f172a', color: '#fff', border: 0, padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 14 };
const btnRoute   = { background: '#16a34a', color: '#fff', border: 0, padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 14, display: 'inline-flex', alignItems: 'center' };
