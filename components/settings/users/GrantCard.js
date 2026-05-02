'use client';

// components/settings/users/GrantCard.js
// Per-grant card. Header shows scope/module/role. Expand to edit capabilities.

import { useState } from 'react';
import { Loader2, Trash2, ChevronDown, ChevronUp, Building2, Briefcase } from 'lucide-react';
import { tokens } from '@/components/settings/_tokens';
import CapabilitiesEditor from './CapabilitiesEditor';

const ROLE_OPTIONS = [
  { value: 'owner',   label: 'Owner' },
  { value: 'manager', label: 'Manager' },
  { value: 'ops',     label: 'Ops' },
  { value: 'viewer',  label: 'Viewer' },
];

const MODULE_PILLS = {
  str:          { label: 'STR',          bg: tokens.accentBgTint, fg: tokens.accentText },
  ltr:          { label: 'LTR',          bg: tokens.primaryBgTint, fg: tokens.primaryText },
  construction: { label: 'Construction', bg: '#ccfbf1',           fg: '#115e59' },
  marina:       { label: 'Marina',       bg: '#ede9fe',           fg: '#5b21b6' },
};

export default function GrantCard({ userId, grant, onChanged }) {
  const [savingRole, setSavingRole] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState(null);

  async function changeRole(role) {
    setSavingRole(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/users/${userId}/grants/${grant.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.message || j.error || `HTTP ${r.status}`);
      await onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingRole(false);
    }
  }

  async function revoke() {
    const scopeLabel = grant.property_name || grant.entity_name || 'this scope';
    if (!confirm(`Revoke ${grant.role} access to ${scopeLabel} (${grant.module.toUpperCase()})? All capability overrides on this grant will also be removed.`)) return;
    setRevoking(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/users/${userId}/grants/${grant.id}`, { method: 'DELETE' });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.message || j.error || `HTTP ${r.status}`);
      }
      await onChanged();
    } catch (e) {
      setError(e.message);
      setRevoking(false);
    }
  }

  const pill = MODULE_PILLS[grant.module] || { label: grant.module, bg: tokens.surfaceMuted, fg: tokens.textSecondary };
  const isProperty = !!grant.property_id;
  const overrideCount = grant.overrides?.length || 0;

  return (
    <div style={s.card}>
      <div style={s.row}>
        <div style={s.scopeWrap}>
          {isProperty ? <Building2 size={16} style={{ color: tokens.textSecondary }} /> : <Briefcase size={16} style={{ color: tokens.textSecondary }} />}
          <div style={s.scopeText}>
            <div style={s.scopeName}>
              {isProperty ? (grant.property_name || '(unnamed property)') : (grant.entity_name || '(unnamed entity)')}
            </div>
            {isProperty && grant.property_address && (
              <div style={s.scopeSub}>{grant.property_address}</div>
            )}
            {!isProperty && (
              <div style={s.scopeSub}>Entity-wide access</div>
            )}
          </div>
        </div>

        <div style={s.modulePillWrap}>
          <span style={{ ...s.modulePill, background: pill.bg, color: pill.fg }}>{pill.label}</span>
        </div>

        <div style={s.roleWrap}>
          <select
            value={grant.role}
            disabled={savingRole || revoking}
            onChange={(e) => changeRole(e.target.value)}
            style={s.roleSelect}
          >
            {ROLE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {savingRole && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: tokens.textTertiary }} />}
        </div>

        <div style={s.actions}>
          <button
            onClick={() => setExpanded(v => !v)}
            style={s.expandBtn}
            disabled={revoking}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            <span>Permissions{overrideCount > 0 ? ` (${overrideCount})` : ''}</span>
          </button>
          <button
            onClick={revoke}
            disabled={revoking || savingRole}
            style={s.revokeBtn}
            title="Revoke this grant"
          >
            {revoking ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={14} />}
          </button>
        </div>
      </div>

      {error && <div style={s.errBar}>{error}</div>}

      {expanded && (
        <div style={s.editorWrap}>
          <CapabilitiesEditor
            userId={userId}
            grant={grant}
            onChanged={onChanged}
          />
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const s = {
  card: {
    background: tokens.surface,
    border: `1px solid ${tokens.border}`,
    borderRadius: 10,
    overflow: 'hidden',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr auto auto auto',
    alignItems: 'center',
    gap: 16,
    padding: 16,
  },
  scopeWrap: { display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 },
  scopeText: { minWidth: 0 },
  scopeName: {
    fontSize: 14, fontWeight: 600, color: tokens.textPrimary,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  scopeSub: {
    fontSize: 12, color: tokens.textSecondary, marginTop: 2,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  modulePillWrap: {},
  modulePill: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  roleWrap: { display: 'flex', alignItems: 'center', gap: 6 },
  roleSelect: {
    padding: '5px 8px',
    border: `1px solid ${tokens.border}`,
    borderRadius: 6,
    fontSize: 13,
    background: tokens.surface,
    color: tokens.textPrimary,
  },
  actions: { display: 'flex', alignItems: 'center', gap: 8 },
  expandBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    background: 'transparent',
    border: `1px solid ${tokens.border}`,
    color: tokens.textPrimary,
    padding: '5px 10px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
  },
  revokeBtn: {
    background: 'transparent',
    border: `1px solid ${tokens.border}`,
    color: tokens.errorText,
    padding: '5px 8px',
    borderRadius: 6,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errBar: {
    background: tokens.errorBg,
    color: tokens.errorText,
    fontSize: 12,
    padding: '6px 16px',
    borderTop: `1px solid ${tokens.border}`,
  },
  editorWrap: {
    borderTop: `1px solid ${tokens.surfaceMuted}`,
    background: tokens.surfaceMuted,
    padding: 16,
  },
};
