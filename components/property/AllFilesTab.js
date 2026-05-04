// components/property/AllFilesTab.js
// Flat list of all documents attached to a parent (property/project/company/etc.).
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Download, Trash2, Upload } from 'lucide-react';
import UploadDocumentModal from '../UploadDocumentModal';

export default function AllFilesTab({ parentType, parentId }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showUpload, setShowUpload] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/documents?parent_type=${parentType}&parent_id=${parentId}`);
    const j = await r.json();
    setDocs(j.documents || []);
    setLoading(false);
  }, [parentType, parentId]);

  useEffect(() => { reload(); }, [reload]);

  async function handleDelete(d) {
    if (!confirm(`Delete "${d.title}"?`)) return;
    await fetch(`/api/documents/${d.id}`, { method: 'DELETE' });
    reload();
  }

  const filtered = docs.filter(d => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (d.title || '').toLowerCase().includes(s)
      || (d.section || '').toLowerCase().includes(s)
      || (d.subsection || '').toLowerCase().includes(s)
      || (d.description || '').toLowerCase().includes(s);
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title, section, description…"
          style={{ flex: 1, padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14 }}
        />
        <button onClick={() => setShowUpload(true)} style={btnPrimary}>
          <Upload size={14} /> Upload
        </button>
      </div>

      {loading && <p>Loading…</p>}
      {!loading && filtered.length === 0 && <p style={{ color: '#64748b' }}>No files yet.</p>}

      {!loading && filtered.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={th}>Title</th>
              <th style={th}>Section</th>
              <th style={th}>Uploaded</th>
              <th style={{ ...th, width: 100 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(d => (
              <tr key={d.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={td}>
                  <div>{d.title}</div>
                  {d.description && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{d.description}</div>}
                </td>
                <td style={td}>
                  {d.section ? (
                    <span style={{ fontSize: 12, color: '#475569' }}>
                      {d.section}{d.subsection ? ` / ${d.subsection}` : ''}
                    </span>
                  ) : <span style={{ color: '#94a3b8' }}>—</span>}
                </td>
                <td style={td}>
                  <span style={{ fontSize: 12, color: '#64748b' }}>
                    {new Date(d.created_at).toLocaleDateString()}
                  </span>
                </td>
                <td style={{ ...td, textAlign: 'right' }}>
                  {d.download_url && (
                    <a href={d.download_url} target="_blank" rel="noreferrer" style={iconBtn} title="Download">
                      <Download size={14} />
                    </a>
                  )}
                  <button onClick={() => handleDelete(d)} style={iconBtn} title="Delete">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showUpload && (
        <UploadDocumentModal
          parentType={parentType}
          parentId={parentId}
          onClose={() => setShowUpload(false)}
          onUploaded={() => reload()}
        />
      )}
    </div>
  );
}

const btnPrimary = { display: 'inline-flex', alignItems: 'center', gap: 6, background: '#0f172a', color: '#fff', border: 0, padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 14 };
const th = { textAlign: 'left', padding: '10px 12px', fontWeight: 600, fontSize: 12, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.4 };
const td = { padding: '10px 12px', verticalAlign: 'top' };
const iconBtn = { background: 'transparent', border: 0, padding: '4px 8px', cursor: 'pointer', color: '#64748b', display: 'inline-flex' };
