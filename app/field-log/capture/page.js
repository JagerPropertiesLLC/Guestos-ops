// app/field-log/capture/page.js
// Mobile-friendly photo capture flow.
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Camera as CameraIcon } from 'lucide-react';
import TargetPicker from '@/components/field-log/TargetPicker';
import QuickTagOverlay from '@/components/field-log/QuickTagOverlay';

export default function FieldLogCapturePage() {
  const [target, setTarget] = useState(null);
  const [units, setUnits] = useState([]);
  const [showOverlay, setShowOverlay] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingPreview, setPendingPreview] = useState(null);
  const [defaults, setDefaults] = useState({ unit_id: null, photo_type: null, note: '' });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(0); // count of successfully captured photos this session
  const inputRef = useRef(null);

  // When target changes (and is a property), fetch units.
  useEffect(() => {
    if (target?.kind === 'property') {
      fetch(`/api/properties/${target.id}`).then(r => r.json()).then(j => {
        setUnits((j.units || []).filter(u => u.active !== false));
      }).catch(() => setUnits([]));
    } else {
      setUnits([]);
    }
  }, [target]);

  function handlePickTarget(t) {
    setTarget(t);
    // If the picked target was an active-cleaning row, pre-fill its unit_id.
    if (t?.unit_id) {
      setDefaults(d => ({ ...d, unit_id: t.unit_id }));
    }
  }

  function openCamera() {
    if (!target) return;
    inputRef.current?.click();
  }

  function handleFileChosen(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setPendingPreview(URL.createObjectURL(file));
    setShowOverlay(true);
    e.target.value = ''; // allow re-picking same file
  }

  async function handleSubmit(tags) {
    if (!pendingFile) return;
    setError('');
    setUploading(true);
    try {
      // Capture geolocation if available (best-effort, non-blocking).
      let lat = null, lng = null;
      if ('geolocation' in navigator) {
        try {
          const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000, maximumAge: 60000 });
          });
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        } catch { /* user denied or timeout — proceed without */ }
      }

      const fd = new FormData();
      fd.append('file', pendingFile);
      if (tags.property_id) fd.append('property_id', tags.property_id);
      if (tags.project_id)  fd.append('project_id',  tags.project_id);
      if (tags.unit_id)     fd.append('unit_id',     tags.unit_id);
      if (tags.photo_type && !tags._skip) fd.append('photo_type', tags.photo_type);
      if (tags.note && !tags._skip) fd.append('note', tags.note);
      fd.append('captured_at', new Date().toISOString());
      if (lat) fd.append('captured_lat', String(lat));
      if (lng) fd.append('captured_lng', String(lng));

      const r = await fetch('/api/field-log/capture', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);

      setSuccess(s => s + 1);
      setShowOverlay(false);
      setPendingFile(null);
      setPendingPreview(null);
      // Persist last-used unit + type as defaults for the next photo this session.
      setDefaults({ unit_id: tags.unit_id, photo_type: tags.photo_type, note: '' });
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={pageWrap}>
      <Link href="/field-log" style={backLink}><ChevronLeft size={14} /> Back</Link>
      <h1 style={{ margin: '12px 0 4px', fontSize: 24 }}>Capture</h1>
      <p style={{ color: '#64748b', marginTop: 0 }}>
        {success > 0 && <span style={{ color: '#16a34a', fontWeight: 500 }}>{success} captured this session · </span>}
        Pick a target, then take photos. Tag each one as you go.
      </p>

      {!target ? (
        <TargetPicker onPick={handlePickTarget} />
      ) : (
        <div style={targetBox}>
          <div>
            <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6 }}>{target.kind}</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{target.name}</div>
          </div>
          <button onClick={() => setTarget(null)} style={changeBtn}>Change</button>
        </div>
      )}

      {target && (
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <button onClick={openCamera} style={cameraBtn} disabled={uploading}>
            <CameraIcon size={28} />
            <span style={{ marginLeft: 10 }}>{uploading ? 'Uploading…' : 'Take Photo'}</span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChosen}
            style={{ display: 'none' }}
          />
        </div>
      )}

      {error && <div style={errorBox}>{error}</div>}

      {showOverlay && (
        <QuickTagOverlay
          target={target}
          units={units}
          initial={defaults}
          onSubmit={handleSubmit}
          onChangeTarget={() => { setShowOverlay(false); setTarget(null); }}
          onClose={() => { setShowOverlay(false); setPendingFile(null); setPendingPreview(null); }}
          saveLabel="Save & Next"
        />
      )}

      {showOverlay && pendingPreview && (
        <div style={previewBar}>
          <img src={pendingPreview} alt="" style={previewImg} />
        </div>
      )}
    </div>
  );
}

const pageWrap = { maxWidth: 600, margin: '0 auto', padding: '20px 16px 100px' };
const backLink = { color: '#64748b', textDecoration: 'none', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 };
const targetBox = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 14, background: '#0f172a', color: '#fff', borderRadius: 10, marginTop: 12 };
const changeBtn = { fontSize: 12, color: '#fff', background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 5, padding: '4px 10px', cursor: 'pointer' };
const cameraBtn = { display: 'inline-flex', alignItems: 'center', padding: '20px 32px', background: '#0f172a', color: '#fff', border: 0, borderRadius: 12, fontSize: 17, fontWeight: 500, cursor: 'pointer' };
const errorBox = { marginTop: 16, padding: 12, background: '#fee2e2', color: '#b91c1c', borderRadius: 8, fontSize: 14 };
const previewBar = { position: 'fixed', bottom: 110, left: 16, right: 16, maxWidth: 600, margin: '0 auto', zIndex: 99 };
const previewImg = { width: 60, height: 60, objectFit: 'cover', borderRadius: 8, border: '2px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' };
