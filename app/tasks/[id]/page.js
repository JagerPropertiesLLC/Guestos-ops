'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';

export default function TaskDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [task, setTask] = useState(null);
  const [assignee, setAssignee] = useState(null);
  const [property, setProperty] = useState(null);
  const [unit, setUnit] = useState(null);
  const [vendor, setVendor] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Completion flow state
  const [completionPhotoFile, setCompletionPhotoFile] = useState(null);
  const [completionPhotoPath, setCompletionPhotoPath] = useState(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    loadTask();
  }, [id]);

  async function loadTask() {
    setLoading(true);
    const { data: t, error: e } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();

    if (e) {
      setError(e.message);
      setLoading(false);
      return;
    }

    setTask(t);

    // Hydrate related rows
    const promises = [];
    if (t.assigned_to_id) {
      promises.push(
        supabase.from('dream_team').select('*').eq('id', t.assigned_to_id).single()
          .then((r) => setAssignee(r.data))
      );
    }
    if (t.property_id) {
      promises.push(
        supabase.from('properties').select('*').eq('id', t.property_id).single()
          .then((r) => setProperty(r.data))
      );
    }
    if (t.unit_id) {
      promises.push(
        supabase.from('units').select('*').eq('id', t.unit_id).single()
          .then((r) => setUnit(r.data))
      );
    }
    if (t.vendor_contact_id) {
      promises.push(
        supabase.from('contacts').select('*').eq('id', t.vendor_contact_id).single()
          .then((r) => setVendor(r.data))
      );
    }
    await Promise.all(promises);
    setLoading(false);
  }

  function getPhotoUrl(path) {
    if (!path) return null;
    const { data } = supabase.storage.from('task-photos').getPublicUrl(path);
    return data?.publicUrl;
  }

  async function startTask() {
    const { error } = await supabase
      .from('tasks')
      .update({ status: 'in_progress', started_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      setError(error.message);
      return;
    }
    loadTask();
  }

  async function handleCompletionPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setCompletionPhotoFile(file);
    setUploading(true);

    try {
      const ext = file.name.split('.').pop();
      const fileName = `completion-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('task-photos')
        .upload(fileName, file, { contentType: file.type });

      if (uploadError) throw uploadError;
      setCompletionPhotoPath(fileName);
    } catch (err) {
      setError('Photo upload failed: ' + err.message);
      setCompletionPhotoFile(null);
      setCompletionPhotoPath(null);
    } finally {
      setUploading(false);
    }
  }

  async function completeTask() {
    if (!completionPhotoPath) {
      setError('A completion photo is required.');
      return;
    }
    setError('');
    setCompleting(true);
    try {
      const newPhotos = [...(task.completion_photos || []), completionPhotoPath];
      const { error: updErr } = await supabase
        .from('tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completion_photos: newPhotos,
          completion_notes: completionNotes || null,
        })
        .eq('id', id);
      if (updErr) throw updErr;
      loadTask();
      setCompletionPhotoFile(null);
      setCompletionPhotoPath(null);
      setCompletionNotes('');
    } catch (err) {
      setError('Could not complete task: ' + err.message);
    } finally {
      setCompleting(false);
    }
  }

  async function cancelTask() {
    if (!confirm('Cancel this task? This cannot be undone.')) return;
    const { error } = await supabase
      .from('tasks')
      .update({ status: 'cancelled' })
      .eq('id', id);
    if (error) {
      setError(error.message);
      return;
    }
    loadTask();
  }

  if (loading) {
    return <main style={styles.page}><p>Loading...</p></main>;
  }

  if (!task) {
    return <main style={styles.page}><p>Task not found.</p></main>;
  }

  const issuePhotos = task.issue_photos || [];
  const completionPhotos = task.completion_photos || [];

  return (
    <main style={styles.page}>
      <div style={styles.header}>
        <a href="/tasks" style={styles.backLink}>← All tasks</a>
        <div style={styles.statusRow}>
          <span style={{ ...styles.badge, ...priorityBadge(task.priority) }}>{task.priority}</span>
          <span style={{ ...styles.badge, ...statusBadge(task.status) }}>
            {task.status.replace('_', ' ')}
          </span>
        </div>
        <h1 style={styles.h1}>{task.title}</h1>
      </div>

      {error && <div style={styles.errorBanner}>{error}</div>}

      <div style={styles.card}>
        <div style={styles.section}>
          <div style={styles.sectionLabel}>Description</div>
          <p style={styles.body}>{task.description}</p>
        </div>

        <div style={styles.metaGrid}>
          <div>
            <div style={styles.metaLabel}>Assigned to</div>
            <div style={styles.metaValue}>{assignee?.display_name || '—'}</div>
          </div>
          <div>
            <div style={styles.metaLabel}>Property</div>
            <div style={styles.metaValue}>
              {property?.name || '—'}
              {unit ? ` · Unit ${unit.unit_number || unit.name}` : ''}
            </div>
          </div>
          {vendor && (
            <div>
              <div style={styles.metaLabel}>Vendor</div>
              <div style={styles.metaValue}>
                {vendor.first_name} {vendor.last_name || ''}
                {vendor.trade ? ` (${vendor.trade})` : ''}
              </div>
            </div>
          )}
          <div>
            <div style={styles.metaLabel}>Created</div>
            <div style={styles.metaValue}>{new Date(task.created_at).toLocaleString()}</div>
          </div>
          {task.completed_at && (
            <div>
              <div style={styles.metaLabel}>Completed</div>
              <div style={styles.metaValue}>{new Date(task.completed_at).toLocaleString()}</div>
            </div>
          )}
        </div>

        {issuePhotos.length > 0 && (
          <div style={styles.section}>
            <div style={styles.sectionLabel}>Issue photos</div>
            <div style={styles.photoGrid}>
              {issuePhotos.map((p) => (
                <a key={p} href={getPhotoUrl(p)} target="_blank" rel="noreferrer">
                  <img src={getPhotoUrl(p)} alt="" style={styles.photo} />
                </a>
              ))}
            </div>
          </div>
        )}

        {completionPhotos.length > 0 && (
          <div style={styles.section}>
            <div style={styles.sectionLabel}>Completion photos</div>
            <div style={styles.photoGrid}>
              {completionPhotos.map((p) => (
                <a key={p} href={getPhotoUrl(p)} target="_blank" rel="noreferrer">
                  <img src={getPhotoUrl(p)} alt="" style={styles.photo} />
                </a>
              ))}
            </div>
          </div>
        )}

        {task.completion_notes && (
          <div style={styles.section}>
            <div style={styles.sectionLabel}>Completion notes</div>
            <p style={styles.body}>{task.completion_notes}</p>
          </div>
        )}

        {/* Action buttons */}
        {task.status === 'open' && (
          <div style={styles.actions}>
            <button onClick={startTask} style={styles.primaryBtn}>Start work</button>
            <button onClick={cancelTask} style={styles.cancelBtn}>Cancel task</button>
          </div>
        )}

        {task.status === 'in_progress' && (
          <div style={styles.completionSection}>
            <div style={styles.sectionLabel}>Mark complete</div>
            <p style={styles.hint}>A completion photo is required.</p>

            {!completionPhotoPath ? (
              <label style={styles.photoUploadBox}>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleCompletionPhoto}
                  style={{ display: 'none' }}
                />
                <span style={styles.photoUploadText}>
                  {uploading ? 'Uploading...' : '📷 Upload completion photo'}
                </span>
              </label>
            ) : (
              <div style={styles.photoBox}>
                <img src={getPhotoUrl(completionPhotoPath)} alt="" style={styles.photoPreview} />
                <button
                  onClick={() => {
                    setCompletionPhotoFile(null);
                    setCompletionPhotoPath(null);
                  }}
                  style={styles.removePhoto}
                >
                  Replace
                </button>
              </div>
            )}

            <textarea
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
              placeholder="Optional notes about how it was fixed..."
              rows={3}
              style={styles.textarea}
            />

            <div style={styles.actions}>
              <button
                onClick={completeTask}
                disabled={!completionPhotoPath || completing}
                style={styles.primaryBtn}
              >
                {completing ? 'Completing...' : 'Mark complete'}
              </button>
              <button onClick={cancelTask} style={styles.cancelBtn}>Cancel task</button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function priorityBadge(p) {
  const map = {
    urgent: { background: '#dc2626', color: 'white' },
    high: { background: '#ea580c', color: 'white' },
    medium: { background: '#fef3c7', color: '#92400e' },
    low: { background: '#f3f4f6', color: '#6b7280' },
  };
  return map[p] || map.medium;
}

function statusBadge(s) {
  const map = {
    open: { background: '#dbeafe', color: '#1e40af' },
    in_progress: { background: '#fef3c7', color: '#92400e' },
    completed: { background: '#d1fae5', color: '#065f46' },
    cancelled: { background: '#f3f4f6', color: '#6b7280' },
  };
  return map[s] || map.open;
}

const styles = {
  page: { maxWidth: 720, margin: '0 auto', padding: '20px 16px 60px', fontFamily: 'system-ui, -apple-system, sans-serif' },
  header: { marginBottom: 20 },
  backLink: { fontSize: 14, color: '#6b7280', textDecoration: 'none' },
  statusRow: { display: 'flex', gap: 6, marginTop: 8 },
  h1: { fontSize: 26, margin: '12px 0 0 0', fontWeight: 600, lineHeight: 1.2 },
  card: { background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 20 },
  section: { display: 'flex', flexDirection: 'column', gap: 6 },
  sectionLabel: { fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  body: { fontSize: 15, color: '#374151', margin: 0, lineHeight: 1.5 },
  metaGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 },
  metaLabel: { fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  metaValue: { fontSize: 14, color: '#111827' },
  photoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 },
  photo: { width: '100%', height: 120, objectFit: 'cover', borderRadius: 8, border: '1px solid #e5e7eb', cursor: 'zoom-in' },
  badge: { padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.3 },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  primaryBtn: { padding: '12px 18px', background: '#0f6e56', color: 'white', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 500, cursor: 'pointer' },
  cancelBtn: { padding: '12px 18px', background: 'white', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 15, cursor: 'pointer' },
  completionSection: { display: 'flex', flexDirection: 'column', gap: 12, padding: 16, background: '#f9fafb', borderRadius: 10 },
  hint: { fontSize: 13, color: '#6b7280', margin: '-6px 0 0 0' },
  photoBox: { position: 'relative' },
  photoPreview: { width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 8 },
  removePhoto: { position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.7)', color: 'white', border: 'none', borderRadius: 6, padding: '6px 10px', fontSize: 12, cursor: 'pointer' },
  photoUploadBox: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, border: '2px dashed #d1d5db', borderRadius: 8, cursor: 'pointer', background: 'white' },
  photoUploadText: { color: '#6b7280', fontSize: 15 },
  textarea: { padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 15, fontFamily: 'inherit', resize: 'vertical' },
  errorBanner: { background: '#fee2e2', color: '#991b1b', padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 14 },
};
