// components/property/SiteVisitsTab.js
// Daily Photos / Site Visits — grid of progress + reference photos for the
// property, grouped by date. "Generate report" opens a date-range picker.
'use client';

import { useEffect, useState, useCallback } from 'react';
import { FileText, Camera } from 'lucide-react';

export default function SiteVisitsTab({ propertyId, projectId, property, project }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showReport, setShowReport] = useState(false);

  const parentType = projectId ? 'project' : 'property';
  const parentId   = projectId || propertyId;

  const reload = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/documents?parent_type=${parentType}&parent_id=${parentId}`);
    const j = await r.json();
    const siteVisits = (j.documents || []).filter(d => d.subsection === 'site-visits');
    setDocs(siteVisits);
    setLoading(false);
  }, [parentType, parentId]);

  useEffect(() => { reload(); }, [reload]);

  // Group by ISO date (YYYY-MM-DD), descending.
  const byDate = {};
  for (const d of docs) {
    const day = (d.created_at || '').slice(0, 10);
    byDate[day] ??= [];
    byDate[day].push(d);
  }
  const dateKeys = Object.keys(byDate).sort().reverse();

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p style={{ color: '#64748b', margin: 0 }}>
          Progress + reference photos routed from the field log show up here.
          {' '}<a href="/field-log/capture" style={{ color: '#0f172a' }}>Capture a new photo →</a>
        </p>
        <button onClick={() => setShowReport(true)} style={btnPrimary}>
          <FileText size={14} /> Generate report
        </button>
      </div>

      {loading && <p>Loading…</p>}
      {!loading && dateKeys.length === 0 && (
        <div style={emptyState}>
          <Camera size={32} style={{ color: '#cbd5e1' }} />
          <p style={{ marginTop: 12, color: '#64748b' }}>No site visit photos yet.</p>
        </div>
      )}

      {dateKeys.map(day => (
        <div key={day} style={{ marginBottom: 24 }}>
          <h3 style={dateHead}>{new Date(day).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</h3>
          <div style={photoGrid}>
            {byDate[day].map(d => (
              <a key={d.id} href={d.download_url || '#'} target="_blank" rel="noreferrer" style={photoCard}>
                {d.download_url && d.mime_type?.startsWith('image/') ? (
                  <img src={d.download_url} alt={d.title} style={photoImg} />
                ) : (
                  <div style={photoPlaceholder}>
                    <FileText size={20} />
                  </div>
                )}
                {d.title && d.title !== `Site visit photo — ${d.created_at}` && (
                  <div style={photoCaption}>{d.title}</div>
                )}
              </a>
            ))}
          </div>
        </div>
      ))}

      {showReport && (
        <PhotoReportModal
          parentType={parentType}
          parentId={parentId}
          entityName={property?.short_name || project?.name || 'Report'}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}

function PhotoReportModal({ parentType, parentId, entityName, onClose }) {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [start, setStart] = useState(monthAgo);
  const [end, setEnd]     = useState(today);
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState('');

  async function generate() {
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/photo-reports/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          entity_type: parentType,
          entity_id: parentId,
          start_date: start,
          end_date: end,
          title: `${entityName} — site visit photos`
        })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      // Open the signed URL in a new tab.
      if (j.url) window.open(j.url, '_blank');
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={modalCard}>
        <h2 style={{ margin: 0, fontSize: 17 }}>Generate photo report</h2>
        <div style={{ marginTop: 14 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#475569', marginBottom: 4 }}>From</label>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={input} />
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#475569', marginBottom: 4 }}>To</label>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} style={input} />
        </div>
        {error && <div style={errorBox}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button onClick={onClose} style={btnSecondary}>Cancel</button>
          <button onClick={generate} disabled={busy} style={btnPrimary}>
            {busy ? 'Generating…' : 'Generate PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}

const btnPrimary   = { display: 'inline-flex', alignItems: 'center', gap: 6, background: '#0f172a', color: '#fff', border: 0, padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 14 };
const btnSecondary = { background: '#fff', color: '#475569', border: '1px solid #cbd5e1', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 14 };
const emptyState   = { padding: 40, textAlign: 'center', background: '#f8fafc', borderRadius: 10, border: '1px dashed #cbd5e1' };
const dateHead     = { fontSize: 13, fontWeight: 600, color: '#475569', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: 0.5 };
const photoGrid    = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 };
const photoCard    = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', textDecoration: 'none', color: 'inherit' };
const photoImg     = { width: '100%', height: 130, objectFit: 'cover', display: 'block' };
const photoPlaceholder = { height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', color: '#94a3b8' };
const photoCaption = { padding: '6px 8px', fontSize: 12, color: '#475569' };
const overlay      = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 };
const modalCard    = { background: '#fff', borderRadius: 10, padding: 20, width: 380 };
const input        = { width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' };
const errorBox     = { color: '#b91c1c', fontSize: 13, marginTop: 12, padding: 8, background: '#fee2e2', borderRadius: 6 };
