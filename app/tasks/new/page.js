'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, RAILWAY_URL } from '../../../lib/supabase';

export default function NewTaskPage() {
  const router = useRouter();

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoPath, setPhotoPath] = useState(null); // Supabase storage path after upload
  const [propertyId, setPropertyId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [vendorContactId, setVendorContactId] = useState('');
  const [priority, setPriority] = useState('medium');

  // Loading / status
  const [uploading, setUploading] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // AI suggestion state
  const [suggestion, setSuggestion] = useState(null); // { suggestedTitle, suggestedDescription, missingInfo }

  // Dropdown data
  const [properties, setProperties] = useState([]);
  const [units, setUnits] = useState([]);
  const [team, setTeam] = useState([]);
  const [vendors, setVendors] = useState([]);

  // Load dropdown data on mount
  useEffect(() => {
    (async () => {
      const [{ data: props }, { data: tm }, { data: ven }] = await Promise.all([
        supabase.from('properties').select('id, name').order('name'),
        supabase
          .from('dream_team')
          .select('id, display_name, role')
          .eq('active', true)
          .order('display_name'),
        supabase
          .from('contacts')
          .select('id, first_name, last_name, trade')
          .order('first_name'),
      ]);
      setProperties(props || []);
      setTeam(tm || []);
      setVendors(ven || []);
    })();
  }, []);

  // Load units when property changes
  useEffect(() => {
    if (!propertyId) {
      setUnits([]);
      setUnitId('');
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('units')
        .select('id, name, unit_number')
        .eq('property_id', propertyId)
        .order('unit_number');
      setUnits(data || []);
    })();
  }, [propertyId]);

  // Photo upload handler
  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setUploading(true);

    try {
      const ext = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('task-photos')
        .upload(fileName, file, { contentType: file.type });

      if (uploadError) throw uploadError;
      setPhotoPath(fileName);
    } catch (err) {
      setError('Photo upload failed: ' + err.message);
      setPhotoFile(null);
      setPhotoPreview(null);
      setPhotoPath(null);
    } finally {
      setUploading(false);
    }
  }

  // Get public URL for the uploaded photo
  function getPhotoPublicUrl(path) {
    if (!path) return null;
    const { data } = supabase.storage.from('task-photos').getPublicUrl(path);
    return data?.publicUrl || null;
  }

  // Polish wording — calls Railway /tasks/rewrite
  async function handlePolish() {
    if (!description.trim()) {
      setError('Type something to polish first.');
      return;
    }
    setError('');
    setPolishing(true);
    setSuggestion(null);

    try {
      const property = properties.find((p) => p.id === propertyId);
      const photoUrl = getPhotoPublicUrl(photoPath);

      const resp = await fetch(`${RAILWAY_URL}/tasks/rewrite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: description,
          propertyName: property?.name || null,
          photoUrl: photoUrl,
        }),
      });

      if (!resp.ok) throw new Error(`Polish failed: ${resp.status}`);
      const data = await resp.json();
      setSuggestion(data);
    } catch (err) {
      setError('AI polish failed: ' + err.message);
    } finally {
      setPolishing(false);
    }
  }

  function applySuggestion() {
    if (!suggestion) return;
    if (suggestion.suggestedTitle) setTitle(suggestion.suggestedTitle);
    if (suggestion.suggestedDescription) setDescription(suggestion.suggestedDescription);
    setSuggestion(null);
  }

  // Save the task
  async function handleSave() {
    setError('');

    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    if (!description.trim()) {
      setError('Description is required.');
      return;
    }
    if (!assignedToId) {
      setError('Please assign this task to someone.');
      return;
    }

    setSaving(true);
    try {
      const insert = {
        task_type: 'maintenance',
        title: title.trim(),
        description: description.trim(),
        original_description: suggestion ? null : description.trim(),
        priority,
        status: 'open',
        assigned_to_id: assignedToId,
        vendor_contact_id: vendorContactId || null,
        property_id: propertyId || null,
        unit_id: unitId || null,
        issue_photos: photoPath ? [photoPath] : [],
      };

      const { data, error: insertError } = await supabase
        .from('tasks')
        .insert(insert)
        .select()
        .single();

      if (insertError) throw insertError;
      router.push(`/tasks/${data.id}`);
    } catch (err) {
      setError('Save failed: ' + err.message);
      setSaving(false);
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.header}>
        <a href="/tasks" style={styles.backLink}>← All tasks</a>
        <h1 style={styles.h1}>New maintenance task</h1>
      </div>

      {error && <div style={styles.errorBanner}>{error}</div>}

      <div style={styles.card}>
        {/* Photo first — most useful when reporting an issue */}
        <label style={styles.label}>
          Photo of the issue
          <span style={styles.hint}>Helps the AI write a better description</span>
        </label>
        {photoPreview ? (
          <div style={styles.photoBox}>
            <img src={photoPreview} alt="" style={styles.photoPreview} />
            <button
              type="button"
              onClick={() => {
                setPhotoFile(null);
                setPhotoPreview(null);
                setPhotoPath(null);
              }}
              style={styles.removePhoto}
            >
              Remove photo
            </button>
          </div>
        ) : (
          <label style={styles.photoUploadBox}>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoChange}
              style={{ display: 'none' }}
            />
            <span style={styles.photoUploadText}>
              {uploading ? 'Uploading...' : '📷 Tap to take photo or upload'}
            </span>
          </label>
        )}

        {/* Description with Polish button */}
        <label style={styles.label}>
          What's the issue?
          <span style={styles.hint}>Type it however — we'll polish the wording</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. flix gutter pipe outside back of buildign"
          rows={4}
          style={styles.textarea}
        />
        <div style={styles.polishRow}>
          <button
            type="button"
            onClick={handlePolish}
            disabled={polishing || !description.trim()}
            style={styles.polishBtn}
          >
            {polishing ? 'Thinking...' : '✨ Polish wording'}
          </button>
        </div>

        {/* AI suggestion compare box */}
        {suggestion && (
          <div style={styles.suggestionBox}>
            <div style={styles.suggestionHeader}>AI suggestion</div>

            <div style={styles.compareGrid}>
              <div>
                <div style={styles.compareLabel}>Your text</div>
                <div style={styles.compareOriginal}>{suggestion.original}</div>
              </div>
              <div>
                <div style={styles.compareLabel}>Polished</div>
                <div style={styles.compareSuggested}>
                  <strong>{suggestion.suggestedTitle}</strong>
                  <p style={{ margin: '6px 0 0 0' }}>{suggestion.suggestedDescription}</p>
                </div>
              </div>
            </div>

            {suggestion.missingInfo && suggestion.missingInfo.length > 0 && (
              <div style={styles.missingInfo}>
                <strong>Missing info you might want to add:</strong>
                <ul style={{ margin: '4px 0 0 18px' }}>
                  {suggestion.missingInfo.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>
            )}

            <div style={styles.suggestionButtons}>
              <button type="button" onClick={applySuggestion} style={styles.applyBtn}>
                Use this
              </button>
              <button
                type="button"
                onClick={() => setSuggestion(null)}
                style={styles.dismissBtn}
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {/* Title — auto-filled from AI but editable */}
        <label style={styles.label}>Task title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Short summary, e.g. 'Repair gutter downspout at rear of building'"
          style={styles.input}
        />

        {/* Property + Unit */}
        <div style={styles.twoCol}>
          <div>
            <label style={styles.label}>Property</label>
            <select
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              style={styles.select}
            >
              <option value="">— select —</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={styles.label}>Unit (optional)</label>
            <select
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              disabled={!propertyId || units.length === 0}
              style={styles.select}
            >
              <option value="">— whole property —</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.unit_number ? `Unit ${u.unit_number}` : u.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Assignee + Vendor */}
        <div style={styles.twoCol}>
          <div>
            <label style={styles.label}>Assign to</label>
            <select
              value={assignedToId}
              onChange={(e) => setAssignedToId(e.target.value)}
              style={styles.select}
            >
              <option value="">— select team member —</option>
              {team.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.display_name}
                </option>
              ))}
            </select>
            <a href="/team" style={styles.subLink}>Manage team →</a>
          </div>
          <div>
            <label style={styles.label}>
              Vendor (optional)
              <span style={styles.hint}>If a vendor is doing the work</span>
            </label>
            <select
              value={vendorContactId}
              onChange={(e) => setVendorContactId(e.target.value)}
              style={styles.select}
            >
              <option value="">— none —</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.first_name} {v.last_name || ''} {v.trade ? `(${v.trade})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Priority */}
        <label style={styles.label}>Priority</label>
        <div style={styles.priorityRow}>
          {['low', 'medium', 'high', 'urgent'].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPriority(p)}
              style={{
                ...styles.priorityBtn,
                ...(priority === p ? styles.priorityActive : {}),
                ...(priority === p && p === 'urgent' ? { background: '#dc2626', color: 'white', borderColor: '#dc2626' } : {}),
                ...(priority === p && p === 'high' ? { background: '#ea580c', color: 'white', borderColor: '#ea580c' } : {}),
              }}
            >
              {p}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || uploading}
          style={styles.saveBtn}
        >
          {saving ? 'Saving...' : 'Create task'}
        </button>
      </div>
    </main>
  );
}

const styles = {
  page: { maxWidth: 720, margin: '0 auto', padding: '20px 16px 60px', fontFamily: 'system-ui, -apple-system, sans-serif' },
  header: { marginBottom: 20 },
  backLink: { fontSize: 14, color: '#6b7280', textDecoration: 'none' },
  h1: { fontSize: 26, margin: '8px 0 0 0', fontWeight: 600 },
  card: { background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 },
  label: { fontSize: 14, fontWeight: 500, color: '#374151', display: 'flex', flexDirection: 'column', gap: 2 },
  hint: { fontSize: 12, fontWeight: 400, color: '#9ca3af' },
  input: { padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 16, marginTop: -10 },
  textarea: { padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 16, fontFamily: 'inherit', marginTop: -10, resize: 'vertical' },
  select: { padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 16, background: 'white', marginTop: -10, width: '100%' },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  subLink: { fontSize: 12, color: '#6b7280', textDecoration: 'none', marginTop: 4, display: 'inline-block' },
  photoBox: { position: 'relative', marginTop: -10 },
  photoPreview: { width: '100%', maxHeight: 280, objectFit: 'cover', borderRadius: 8, border: '1px solid #e5e7eb' },
  removePhoto: { position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.7)', color: 'white', border: 'none', borderRadius: 6, padding: '6px 10px', fontSize: 12, cursor: 'pointer' },
  photoUploadBox: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, border: '2px dashed #d1d5db', borderRadius: 8, cursor: 'pointer', marginTop: -10 },
  photoUploadText: { color: '#6b7280', fontSize: 15 },
  polishRow: { marginTop: -8 },
  polishBtn: { padding: '8px 14px', background: '#f3e8ff', color: '#6b21a8', border: '1px solid #d8b4fe', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' },
  suggestionBox: { background: '#faf5ff', border: '1px solid #d8b4fe', borderRadius: 10, padding: 14 },
  suggestionHeader: { fontSize: 13, fontWeight: 600, color: '#6b21a8', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  compareGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  compareLabel: { fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  compareOriginal: { fontSize: 14, color: '#6b7280', padding: 8, background: 'white', borderRadius: 6, border: '1px solid #e5e7eb' },
  compareSuggested: { fontSize: 14, color: '#111827', padding: 8, background: 'white', borderRadius: 6, border: '1px solid #d8b4fe' },
  missingInfo: { fontSize: 13, marginTop: 12, padding: 10, background: 'white', borderRadius: 6, color: '#6b21a8' },
  suggestionButtons: { display: 'flex', gap: 8, marginTop: 12 },
  applyBtn: { padding: '8px 14px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' },
  dismissBtn: { padding: '8px 14px', background: 'white', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, cursor: 'pointer' },
  priorityRow: { display: 'flex', gap: 8, marginTop: -10 },
  priorityBtn: { flex: 1, padding: '10px 14px', background: 'white', border: '1px solid #d1d5db', borderRadius: 8, textTransform: 'capitalize', cursor: 'pointer', fontSize: 14 },
  priorityActive: { background: '#3b82f6', color: 'white', borderColor: '#3b82f6' },
  saveBtn: { padding: '14px', background: '#0f6e56', color: 'white', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: 'pointer', marginTop: 8 },
  errorBanner: { background: '#fee2e2', color: '#991b1b', padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 14 },
};
