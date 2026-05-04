// components/UploadDocumentModal.js
// Reusable file upload modal. POSTs multipart to /api/documents.
'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

export default function UploadDocumentModal({
  parentType,
  parentId,
  defaultSection = null,
  defaultSubsection = null,
  defaultTitle = '',
  fulfillsSlotId = null,
  onClose,
  onUploaded
}) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState('');
  const [section, setSection] = useState(defaultSection);
  const [subsection, setSubsection] = useState(defaultSubsection);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!file) { setError('Pick a file first.'); return; }
    setError('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('parent_type', parentType);
      fd.append('parent_id', parentId);
      if (title) fd.append('title', title);
      if (description) fd.append('description', description);
      if (section) fd.append('section', section);
      if (subsection) fd.append('subsection', subsection);
      if (fulfillsSlotId) fd.append('fulfills_slot_id', fulfillsSlotId);

      const r = await fetch('/api/documents', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      onUploaded?.(j.document);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit} style={card}>
        <div style={header}>
          <h2 style={{ margin: 0, fontSize: 17 }}>{fulfillsSlotId ? `Upload: ${defaultTitle}` : 'Upload document'}</h2>
          <button type="button" onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>
        <div style={body}>
          <Field label="File">
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </Field>
          <Field label="Title">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={file?.name || ''} style={input} />
          </Field>
          <Field label="Description (optional)">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ ...input, minHeight: 50 }} />
          </Field>
          {!fulfillsSlotId && (
            <>
              <Field label="Section (optional)">
                <input value={section || ''} onChange={(e) => setSection(e.target.value || null)} placeholder="e.g., 1-llc-entity" style={input} />
              </Field>
              <Field label="Subsection (optional)">
                <input value={subsection || ''} onChange={(e) => setSubsection(e.target.value || null)} placeholder="e.g., formation-docs" style={input} />
              </Field>
            </>
          )}
          {error && <div style={errorStyle}>{error}</div>}
        </div>
        <div style={footer}>
          <button type="button" onClick={onClose} style={btnSecondary}>Cancel</button>
          <button type="submit" disabled={uploading || !file} style={btnPrimary}>
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: '#475569', marginBottom: 4, fontWeight: 500 }}>{label}</div>
      {children}
    </label>
  );
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 };
const card    = { background: '#fff', borderRadius: 12, width: 480, maxWidth: '92vw', maxHeight: '92vh', overflow: 'auto', display: 'flex', flexDirection: 'column' };
const header  = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e2e8f0' };
const body    = { padding: 20 };
const footer  = { display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '14px 20px', borderTop: '1px solid #e2e8f0' };
const input   = { width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' };
const iconBtn = { background: 'transparent', border: 0, cursor: 'pointer', color: '#64748b' };
const btnPrimary   = { background: '#0f172a', color: '#fff', border: 0, padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 14 };
const btnSecondary = { background: '#fff', color: '#475569', border: '1px solid #cbd5e1', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 14 };
const errorStyle   = { color: '#b91c1c', fontSize: 13, marginTop: 8, padding: 8, background: '#fee2e2', borderRadius: 6 };
