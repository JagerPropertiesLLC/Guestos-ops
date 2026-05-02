'use client';

// components/settings/users/UserDetailCard.js
// User profile card with editable fields. Save-on-blur + save-on-change.

import { useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { tokens } from '@/components/settings/_tokens';
import RolePill from '@/components/settings/RolePill';

const USER_TYPE_OPTIONS = [
  { value: 'owner',   label: 'Owner' },
  { value: 'admin',   label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'ops',     label: 'Ops' },
  { value: 'staff',   label: 'Staff' },
  { value: 'viewer',  label: 'Viewer' },
];

export default function UserDetailCard({ user, isSelf, isLastSuperAdmin, onChanged }) {
  const [saving, setSaving] = useState(null);
  const [errors, setErrors] = useState({});
  const [phone, setPhone] = useState(user.phone || '');
  const [notes, setNotes] = useState(user.notes || '');

  async function patch(field, value) {
    setSaving(field);
    setErrors(e => ({ ...e, [field]: null }));
    try {
      const r = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErrors(e => ({ ...e, [field]: j.message || j.error || `HTTP ${r.status}` }));
        await onChanged();
        return;
      }
      await onChanged();
    } catch (e) {
      setErrors(er => ({ ...er, [field]: e.message }));
    } finally {
      setSaving(null);
    }
  }

  async function promoteToSuperAdmin() {
    if (!confirm('Promote this user to Super admin? They will gain unrestricted access to all properties, entities, and admin settings.')) return;
    await patch('user_type', 'super_admin');
  }

  async function demoteFromSuperAdmin(newType) {
    if (!confirm(`Demote this Super admin to ${newType}? They will lose admin access.`)) return;
    await patch('user_type', newType);
  }

  const isSuperAdmin = user.user_type === 'super_admin';
  const lockUserType = isSelf || (isSuperAdmin && isLastSuperAdmin);
  const lockActive   = isSelf || (isSuperAdmin && isLastSuperAdmin);

  return (
    <section style={s.card}>
      <header style={s.head}>
        <div>
          <h1 style={s.name}>{user.full_name || '(no name)'}</h1>
          <div style={s.email}>{user.email}</div>
        </div>
        <div style={s.headRight}>
          <RolePill userType={user.user_type} />
          {!user.active && <span style={s.inactive}>Inactive</span>}
        </div>
      </header>

      <div style={s.grid}>
        {/* Role */}
        <Field label="Role" hint={lockUserType ? (isSelf ? 'You cannot change your own role.' : 'Cannot demote the last super admin.') : null}>
          <div style={s.roleRow}>
            {isSuperAdmin ? (
              <>
                <span style={s.superBadge}><ShieldCheck size={14} /> Super admin</span>
                <select
                  defaultValue=""
                  disabled={lockUserType || saving === 'user_type'}
                  onChange={(e) => { if (e.target.value) demoteFromSuperAdmin(e.target.value); }}
                  style={s.select}
                >
                  <option value="">Demote to…</option>
                  {USER_TYPE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <select
                  value={user.user_type || ''}
                  disabled={lockUserType || saving === 'user_type'}
                  onChange={(e) => patch('user_type', e.target.value)}
                  style={s.select}
                >
                  {USER_TYPE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <button
                  onClick={promoteToSuperAdmin}
                  disabled={lockUserType || saving === 'user_type'}
                  style={s.promoteBtn}
                >
                  Promote to super admin
                </button>
              </>
            )}
            {saving === 'user_type' && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: tokens.textTertiary }} />}
          </div>
          {errors.user_type && <div style={s.fieldErr}>{errors.user_type}</div>}
        </Field>

        {/* Active */}
        <Field label="Active" hint={lockActive ? (isSelf ? 'You cannot deactivate yourself.' : 'Cannot deactivate the last super admin.') : null}>
          <Toggle
            checked={user.active}
            disabled={lockActive || saving === 'active'}
            onChange={(v) => patch('active', v)}
            saving={saving === 'active'}
          />
          {errors.active && <div style={s.fieldErr}>{errors.active}</div>}
        </Field>

        {/* Portal access */}
        <Field label="Tenant portal access">
          <Toggle
            checked={!!user.has_portal_access}
            disabled={saving === 'has_portal_access'}
            onChange={(v) => patch('has_portal_access', v)}
            saving={saving === 'has_portal_access'}
          />
          {errors.has_portal_access && <div style={s.fieldErr}>{errors.has_portal_access}</div>}
        </Field>

        {/* Phone */}
        <Field label="Phone">
          <div style={s.inputRow}>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={() => { if (phone !== (user.phone || '')) patch('phone', phone || null); }}
              placeholder="+1 555-555-5555"
              style={s.input}
            />
            {saving === 'phone' && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: tokens.textTertiary }} />}
          </div>
          {errors.phone && <div style={s.fieldErr}>{errors.phone}</div>}
        </Field>

        {/* Notes */}
        <Field label="Notes" full>
          <div style={s.inputRow}>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => { if (notes !== (user.notes || '')) patch('notes', notes || null); }}
              rows={3}
              style={s.textarea}
            />
            {saving === 'notes' && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: tokens.textTertiary, alignSelf: 'flex-start', marginTop: 8 }} />}
          </div>
          {errors.notes && <div style={s.fieldErr}>{errors.notes}</div>}
        </Field>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}

function Field({ label, hint, full, children }) {
  return (
    <div style={{ gridColumn: full ? '1 / -1' : 'auto' }}>
      <div style={s.fieldLabel}>{label}</div>
      {children}
      {hint && <div style={s.fieldHint}>{hint}</div>}
    </div>
  );
}

function Toggle({ checked, disabled, onChange, saving }) {
  return (
    <label style={{ ...s.toggleWrap, opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginRight: 8 }}
      />
      <span style={{ fontSize: 14, color: tokens.textPrimary }}>{checked ? 'Yes' : 'No'}</span>
      {saving && <Loader2 size={14} style={{ marginLeft: 8, animation: 'spin 1s linear infinite', color: tokens.textTertiary }} />}
    </label>
  );
}

const s = {
  card: {
    background: tokens.surface,
    border: `1px solid ${tokens.border}`,
    borderRadius: 10,
    padding: 24,
    marginBottom: 24,
  },
  head: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 16,
    marginBottom: 20,
    borderBottom: `1px solid ${tokens.surfaceMuted}`,
  },
  name: { margin: 0, fontSize: 22, color: tokens.textPrimary, fontWeight: 600 },
  email: { marginTop: 4, fontSize: 13, color: tokens.textSecondary, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
  headRight: { display: 'flex', alignItems: 'center', gap: 8 },
  inactive: { fontSize: 11, padding: '2px 8px', borderRadius: 4, background: tokens.surfaceMuted, color: tokens.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px 24px' },
  fieldLabel: { fontSize: 11, color: tokens.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginBottom: 6 },
  fieldHint: { marginTop: 6, fontSize: 12, color: tokens.textTertiary, fontStyle: 'italic' },
  fieldErr: { marginTop: 6, fontSize: 12, color: tokens.errorText },
  roleRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  superBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    background: tokens.accentBgTint, color: tokens.accentText,
    padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
  },
  select: {
    padding: '6px 10px',
    border: `1px solid ${tokens.border}`,
    borderRadius: 6,
    fontSize: 14,
    background: tokens.surface,
    color: tokens.textPrimary,
  },
  promoteBtn: {
    background: 'transparent',
    color: tokens.accent,
    border: `1px solid ${tokens.accent}`,
    padding: '6px 12px',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
  },
  inputRow: { display: 'flex', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    padding: '6px 10px',
    border: `1px solid ${tokens.border}`,
    borderRadius: 6,
    fontSize: 14,
    background: tokens.surface,
  },
  textarea: {
    flex: 1,
    padding: '8px 10px',
    border: `1px solid ${tokens.border}`,
    borderRadius: 6,
    fontSize: 14,
    background: tokens.surface,
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  toggleWrap: { display: 'inline-flex', alignItems: 'center' },
};
