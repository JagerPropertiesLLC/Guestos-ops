'use client';

// components/construction/NewProjectModal.js
// Create a new construction project.

import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { tokens, PROJECT_TYPE_OPTIONS, PROJECT_STATUS_OPTIONS } from './_tokens';

export default function NewProjectModal({ onClose, onCreated }) {
  const [lookups, setLookups] = useState({ markets: [], properties: [], entities: [] });
  const [loadingLookups, setLoadingLookups] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [name, setName] = useState('');
  const [type, setType] = useState('new_construction');
  const [status, setStatus] = useState('planning');
  const [marketId, setMarketId] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [entityId, setEntityId] = useState('');
  const [address, setAddress] = useState('');
  const [totalBudget, setTotalBudget] = useState('');
  const [startDate, setStartDate] = useState('');
  const [targetCompletion, setTargetCompletion] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    let alive = true;
    fetch('/api/construction/lookups')
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(j => {
        if (!alive) return;
        setLookups({
          markets:    j.markets    || [],
          properties: j.properties || [],
          entities:   j.entities   || [],
        });
        if (j.markets?.length === 1) setMarketId(j.markets[0].id);
      })
      .catch(e => { if (alive) setError(e.message); })
      .finally(() => { if (alive) setLoadingLookups(false); });
    return () => { alive = false; };
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (!name.trim())  { setError('Project name is required.'); return; }
    if (!marketId)     { setError('Market is required.'); return; }

    setSubmitting(true);
    try {
      const r = await fetch('/api/construction/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          type,
          status,
          market_id: marketId,
          property_id: propertyId || null,
          entity_id:   entityId   || null,
          address: address.trim() || null,
          total_budget: totalBudget ? Number(totalBudget) : null,
          start_date: startDate || null,
          target_completion: targetCompletion || null,
          notes: notes.trim() || null,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.message || j.error || `HTTP ${r.status}`);
      await onCreated(j.project);
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <header style={s.header}>
          <h3 style={s.title}>New construction project</h3>
          <button onClick={onClose} style={s.closeBtn}><X size={18} /></button>
        </header>

        <form onSubmit={submit} style={s.form}>
          <Field label="Project name" required>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. West Center Tech – 201 N Laredo" style={s.input} required />
          </Field>

          <Row>
            <Field label="Type" required>
              <select value={type} onChange={(e) => setType(e.target.value)} style={s.input}>
                {PROJECT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select value={status} onChange={(e) => setStatus(e.target.value)} style={s.input}>
                {PROJECT_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          </Row>

          <Field label="Market" required>
            <select value={marketId} onChange={(e) => setMarketId(e.target.value)} style={s.input} required disabled={loadingLookups}>
              <option value="">{loadingLookups ? 'Loading…' : 'Choose a market…'}</option>
              {lookups.markets.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>

          <Row>
            <Field label="Owning entity" hint="LLC that owns the project">
              <select value={entityId} onChange={(e) => setEntityId(e.target.value)} style={s.input} disabled={loadingLookups}>
                <option value="">— none —</option>
                {lookups.entities.map(en => <option key={en.id} value={en.id}>{en.name}</option>)}
              </select>
            </Field>
            <Field label="Existing rental property" hint="Optional — only if this is work on an STR/LTR property">
              <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} style={s.input} disabled={loadingLookups}>
                <option value="">— none —</option>
                {lookups.properties.map(p => <option key={p.id} value={p.id}>{p.short_name}</option>)}
              </select>
            </Field>
          </Row>

          <Field label="Address" hint="Free text — useful when this isn't a rental property in our DB">
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="201 N Laredo St, Aurora, CO 80011" style={s.input} />
          </Field>

          <Row>
            <Field label="Total budget">
              <input type="number" step="any" min="0" value={totalBudget} onChange={(e) => setTotalBudget(e.target.value)} placeholder="0" style={s.input} />
            </Field>
            <Field label="Start date">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={s.input} />
            </Field>
            <Field label="Target completion">
              <input type="date" value={targetCompletion} onChange={(e) => setTargetCompletion(e.target.value)} style={s.input} />
            </Field>
          </Row>

          <Field label="Notes">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={s.textarea} />
          </Field>

          {error && <div style={s.error}>{error}</div>}

          <div style={s.actions}>
            <button type="button" onClick={onClose} style={s.cancelBtn} disabled={submitting}>Cancel</button>
            <button type="submit" style={s.submitBtn} disabled={submitting || loadingLookups}>
              {submitting && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
              <span>{submitting ? 'Creating…' : 'Create project'}</span>
            </button>
          </div>
        </form>

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

function Field({ label, hint, required, children }) {
  return (
    <div>
      <div style={s.label}>
        {label}{required && <span style={{ color: tokens.errorText, marginLeft: 2 }}>*</span>}
      </div>
      {children}
      {hint && <div style={s.hint}>{hint}</div>}
    </div>
  );
}

function Row({ children }) {
  return <div style={s.row}>{children}</div>;
}

const s = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(17,24,39,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 50, padding: 20,
    overflowY: 'auto',
  },
  modal: {
    background: tokens.surface,
    borderRadius: 12,
    width: '100%',
    maxWidth: 640,
    boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
    maxHeight: 'calc(100vh - 40px)',
    overflowY: 'auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: `1px solid ${tokens.surfaceMuted}`,
  },
  title: { margin: 0, fontSize: 16, fontWeight: 600, color: tokens.textPrimary },
  closeBtn: {
    background: 'transparent', border: 0, cursor: 'pointer',
    color: tokens.textSecondary, padding: 4, display: 'inline-flex',
  },
  form: { padding: 20, display: 'flex', flexDirection: 'column', gap: 14 },
  row: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 },
  label: {
    fontSize: 11, color: tokens.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5,
    fontWeight: 600, marginBottom: 6,
  },
  hint: { marginTop: 4, fontSize: 11, color: tokens.textTertiary, fontStyle: 'italic' },
  input: {
    width: '100%',
    padding: '8px 10px',
    border: `1px solid ${tokens.border}`,
    borderRadius: 6,
    fontSize: 14,
    background: tokens.surface,
    color: tokens.textPrimary,
    fontFamily: 'inherit',
  },
  textarea: {
    width: '100%',
    padding: '8px 10px',
    border: `1px solid ${tokens.border}`,
    borderRadius: 6,
    fontSize: 14,
    background: tokens.surface,
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  error: {
    background: tokens.errorBg,
    color: tokens.errorText,
    padding: 10,
    borderRadius: 6,
    fontSize: 13,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    paddingTop: 4,
  },
  cancelBtn: {
    background: tokens.surface,
    color: tokens.textSecondary,
    border: `1px solid ${tokens.border}`,
    padding: '8px 16px',
    borderRadius: 6,
    fontSize: 14,
    cursor: 'pointer',
  },
  submitBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: tokens.primary,
    color: '#fff',
    border: 0,
    padding: '8px 16px',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
  },
};
