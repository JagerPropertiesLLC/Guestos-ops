'use client';

// components/settings/users/GrantAccessModal.js
// Modal for creating a new grant on a user.

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { tokens } from '@/components/settings/_tokens';

const MODULES = [
  { value: 'str',          label: 'STR (short-term rentals)' },
  { value: 'ltr',          label: 'LTR (long-term rentals)' },
  { value: 'construction', label: 'Construction' },
  { value: 'marina',       label: 'Marina' },
];

const ROLES = [
  { value: 'owner',   label: 'Owner — full control on this scope' },
  { value: 'manager', label: 'Manager — operational lead' },
  { value: 'ops',     label: 'Ops — day-to-day execution' },
  { value: 'viewer',  label: 'Viewer — read-only' },
];

export default function GrantAccessModal({ userId, properties, entities, onClose, onCreated }) {
  const [scope, setScope] = useState('property');
  const [propertyId, setPropertyId] = useState('');
  const [entityId, setEntityId] = useState('');
  const [moduleVal, setModuleVal] = useState('str');
  const [role, setRole] = useState('manager');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);

    const body = {
      module: moduleVal,
      role,
      property_id: scope === 'property' ? propertyId : null,
      entity_id:   scope === 'entity'   ? entityId   : null,
    };
    if (scope === 'property' && !propertyId) { setError('Pick a property.'); return; }
    if (scope === 'entity'   && !entityId)   { setError('Pick an entity.');   return; }

    setSubmitting(true);
    try {
      const r = await fetch(`/api/admin/users/${userId}/grants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.message || j.error || `HTTP ${r.status}`);
      await onCreated();
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <header style={s.header}>
          <h3 style={s.title}>Grant access</h3>
          <button onClick={onClose} style={s.closeBtn}><X size={18} /></button>
        </header>

        <form onSubmit={submit} style={s.form}>
          <div>
            <div style={s.label}>Scope</div>
            <div style={s.radioRow}>
              <label style={s.radioWrap}>
                <input type="radio" checked={scope === 'property'} onChange={() => setScope('property')} />
                <span>Specific property</span>
              </label>
              <label style={s.radioWrap}>
                <input type="radio" checked={scope === 'entity'} onChange={() => setScope('entity')} />
                <span>Whole entity (LLC)</span>
              </label>
            </div>
          </div>

          {scope === 'property' ? (
            <div>
              <div style={s.label}>Property</div>
              <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} style={s.select} required>
                <option value="">Choose a property…</option>
                {properties.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.short_name}{p.entity_name ? ` — ${p.entity_name}` : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <div style={s.label}>Entity</div>
              <select value={entityId} onChange={(e) => setEntityId(e.target.value)} style={s.select} required>
                <option value="">Choose an entity…</option>
                {entities.map(en => (
                  <option key={en.id} value={en.id}>{en.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <div style={s.label}>Module</div>
            <select value={moduleVal} onChange={(e) => setModuleVal(e.target.value)} style={s.select}>
              {MODULES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          <div>
            <div style={s.label}>Role</div>
            <select value={role} onChange={(e) => setRole(e.target.value)} style={s.select}>
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          {error && <div style={s.error}>{error}</div>}

          <div style={s.actions}>
            <button type="button" onClick={onClose} style={s.cancelBtn} disabled={submitting}>Cancel</button>
            <button type="submit" style={s.submitBtn} disabled={submitting}>
              {submitting && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
              <span>{submitting ? 'Granting…' : 'Grant access'}</span>
            </button>
          </div>
        </form>

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(17,24,39,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    padding: 20,
  },
  modal: {
    background: tokens.surface,
    borderRadius: 12,
    width: '100%',
    maxWidth: 500,
    boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
    overflow: 'hidden',
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
    background: 'transparent',
    border: 0,
    cursor: 'pointer',
    color: tokens.textSecondary,
    padding: 4,
    display: 'inline-flex',
  },
  form: { padding: 20, display: 'flex', flexDirection: 'column', gap: 16 },
  label: {
    fontSize: 11,
    color: tokens.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: 600,
    marginBottom: 6,
  },
  radioRow: { display: 'flex', gap: 16 },
  radioWrap: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: tokens.textPrimary, cursor: 'pointer' },
  select: {
    width: '100%',
    padding: '8px 10px',
    border: `1px solid ${tokens.border}`,
    borderRadius: 6,
    fontSize: 14,
    background: tokens.surface,
    color: tokens.textPrimary,
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
