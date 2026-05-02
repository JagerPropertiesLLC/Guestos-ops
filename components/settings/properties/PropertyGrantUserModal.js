'use client';

// components/settings/properties/PropertyGrantUserModal.js
// Modal for granting a user direct access to this property. Property is fixed
// (passed in); user is selected from a filtered dropdown; module defaults to
// property.property_type[0]; role is selected.

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

export default function PropertyGrantUserModal({
  property, eligibleUsers, hiddenAlreadyGranted, onClose, onCreated,
}) {
  const defaultModule = (property.property_type && property.property_type[0]) || 'str';

  const [userId, setUserId] = useState('');
  const [moduleVal, setModuleVal] = useState(defaultModule);
  const [role, setRole] = useState('manager');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (!userId) { setError('Pick a user.'); return; }

    setSubmitting(true);
    try {
      const r = await fetch(`/api/admin/users/${userId}/grants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: property.id,
          module: moduleVal,
          role,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (r.status === 500 && /unique|duplicate/i.test(j.error || '')) {
          throw new Error('This user already has a grant for this module on this property.');
        }
        throw new Error(j.message || j.error || `HTTP ${r.status}`);
      }
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
          <div>
            <h3 style={s.title}>Grant access to {property.short_name || property.full_address}</h3>
            <div style={s.subtitle}>Add a direct grant. Indirect access via the entity stays where it is.</div>
          </div>
          <button onClick={onClose} style={s.closeBtn}><X size={18} /></button>
        </header>

        <form onSubmit={submit} style={s.form}>
          <div>
            <div style={s.label}>User</div>
            {eligibleUsers.length === 0 ? (
              <div style={s.emptyUsers}>
                All non-super-admin users already have direct access to this property.
              </div>
            ) : (
              <select value={userId} onChange={(e) => setUserId(e.target.value)} style={s.select} required>
                <option value="">Choose a user…</option>
                {eligibleUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.full_name || u.email}{u.full_name ? ` — ${u.email}` : ''}
                  </option>
                ))}
              </select>
            )}
            {hiddenAlreadyGranted > 0 && (
              <div style={s.hint}>
                Already granted: {hiddenAlreadyGranted} user{hiddenAlreadyGranted === 1 ? '' : 's'} hidden from this list.
              </div>
            )}
          </div>

          <div>
            <div style={s.label}>Module</div>
            <select value={moduleVal} onChange={(e) => setModuleVal(e.target.value)} style={s.select}>
              {MODULES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            {(property.property_type || []).length > 0 && (
              <div style={s.hint}>
                Property is tagged: {property.property_type.join(', ').toUpperCase()}.
                Defaulted to {defaultModule.toUpperCase()}.
              </div>
            )}
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
            <button
              type="submit"
              style={{ ...s.submitBtn, opacity: eligibleUsers.length === 0 ? 0.5 : 1 }}
              disabled={submitting || eligibleUsers.length === 0}
            >
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
    maxWidth: 520,
    boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '16px 20px',
    borderBottom: `1px solid ${tokens.surfaceMuted}`,
    gap: 12,
  },
  title: { margin: 0, fontSize: 16, fontWeight: 600, color: tokens.textPrimary },
  subtitle: { marginTop: 4, fontSize: 12, color: tokens.textSecondary },
  closeBtn: {
    background: 'transparent',
    border: 0,
    cursor: 'pointer',
    color: tokens.textSecondary,
    padding: 4,
    display: 'inline-flex',
    flexShrink: 0,
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
  select: {
    width: '100%',
    padding: '8px 10px',
    border: `1px solid ${tokens.border}`,
    borderRadius: 6,
    fontSize: 14,
    background: tokens.surface,
    color: tokens.textPrimary,
  },
  emptyUsers: {
    fontSize: 13,
    color: tokens.textSecondary,
    fontStyle: 'italic',
    padding: 10,
    background: tokens.surfaceMuted,
    borderRadius: 6,
  },
  hint: { marginTop: 6, fontSize: 12, color: tokens.textTertiary },
  error: {
    background: tokens.errorBg,
    color: tokens.errorText,
    padding: 10,
    borderRadius: 6,
    fontSize: 13,
  },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 },
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
