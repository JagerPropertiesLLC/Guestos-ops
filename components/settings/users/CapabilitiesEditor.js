'use client';

// components/settings/users/CapabilitiesEditor.js
// Tri-state per capability: Inherit (no row) | Enable | Disable.

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { tokens } from '@/components/settings/_tokens';

const ROLE_DEFAULT_KEY = {
  owner:   'default_owner',
  manager: 'default_manager',
  ops:     'default_ops',
  viewer:  'default_viewer',
};

export default function CapabilitiesEditor({ userId, grant, onChanged }) {
  const [caps, setCaps] = useState(null);
  const [error, setError] = useState(null);
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    let alive = true;
    setError(null);
    fetch(`/api/admin/capabilities?module=${encodeURIComponent(grant.module)}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(j => { if (alive) setCaps(j.capabilities || []); })
      .catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [grant.module]);

  const overridesByCap = useMemo(() => {
    const m = new Map();
    for (const o of grant.overrides || []) m.set(o.capability_id, o.enabled);
    return m;
  }, [grant.overrides]);

  const setOverride = useCallback(async (capId, enabled) => {
    setSavingId(capId);
    setError(null);
    try {
      const r = await fetch(`/api/admin/users/${userId}/grants/${grant.id}/capabilities`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capability_id: capId, enabled }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.message || j.error || `HTTP ${r.status}`);
      await onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingId(null);
    }
  }, [userId, grant.id, onChanged]);

  if (error && !caps) {
    return <div style={s.err}>Error loading capabilities: {error}</div>;
  }
  if (!caps) {
    return <div style={s.loading}><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading capabilities…</div>;
  }
  if (caps.length === 0) {
    return <div style={s.empty}>No capabilities apply to the {grant.module.toUpperCase()} module.</div>;
  }

  const defaultKey = ROLE_DEFAULT_KEY[grant.role];
  const grouped = caps.reduce((acc, c) => {
    const k = c.category || 'general';
    (acc[k] = acc[k] || []).push(c);
    return acc;
  }, {});

  return (
    <div>
      <div style={s.legend}>
        Defaults come from the role ({grant.role}). Override per capability with Enable / Disable.
        Click <strong>Inherit</strong> to remove an override and fall back to the role default.
      </div>
      {error && <div style={s.errInline}>{error}</div>}
      {Object.entries(grouped).map(([category, list]) => (
        <div key={category} style={s.section}>
          <div style={s.sectionTitle}>{category}</div>
          <div style={s.list}>
            {list.map(cap => {
              const defaultEnabled = !!cap[defaultKey];
              const override = overridesByCap.get(cap.id);
              const state = override === true ? 'enable' : override === false ? 'disable' : 'inherit';
              const isSaving = savingId === cap.id;
              return (
                <div key={cap.id} style={s.row}>
                  <div style={s.capInfo}>
                    <div style={s.capLabel}>{cap.label || cap.slug}</div>
                    <div style={s.capMeta}>
                      <code style={s.slug}>{cap.slug}</code>
                      <span style={s.dot}>·</span>
                      <span>Default for {grant.role}: {defaultEnabled ? 'enabled' : 'disabled'}</span>
                    </div>
                  </div>
                  <div style={s.btnGroup}>
                    <TriBtn
                      label="Inherit"
                      active={state === 'inherit'}
                      disabled={isSaving}
                      onClick={() => setOverride(cap.id, null)}
                    />
                    <TriBtn
                      label="Enable"
                      tone="ok"
                      active={state === 'enable'}
                      disabled={isSaving}
                      onClick={() => setOverride(cap.id, true)}
                    />
                    <TriBtn
                      label="Disable"
                      tone="bad"
                      active={state === 'disable'}
                      disabled={isSaving}
                      onClick={() => setOverride(cap.id, false)}
                    />
                    {isSaving && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: tokens.textTertiary, marginLeft: 4 }} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function TriBtn({ label, active, disabled, onClick, tone }) {
  let bg, fg, border;
  if (active && tone === 'ok')      { bg = '#d1fae5'; fg = '#065f46'; border = '#10b981'; }
  else if (active && tone === 'bad'){ bg = tokens.errorBg; fg = tokens.errorText; border = '#dc2626'; }
  else if (active)                  { bg = tokens.primaryBgTint; fg = tokens.primaryText; border = tokens.primary; }
  else                              { bg = tokens.surface; fg = tokens.textSecondary; border = tokens.border; }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: bg,
        color: fg,
        border: `1px solid ${border}`,
        padding: '4px 10px',
        borderRadius: 6,
        fontSize: 12,
        fontWeight: active ? 600 : 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {label}
    </button>
  );
}

const s = {
  legend: {
    fontSize: 12,
    color: tokens.textSecondary,
    marginBottom: 12,
    lineHeight: 1.5,
  },
  errInline: {
    background: tokens.errorBg,
    color: tokens.errorText,
    fontSize: 12,
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
  },
  err: {
    color: tokens.errorText,
    fontSize: 13,
  },
  loading: {
    color: tokens.textTertiary,
    fontSize: 13,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },
  empty: {
    color: tokens.textSecondary,
    fontSize: 13,
    fontStyle: 'italic',
  },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 11,
    color: tokens.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: 600,
    marginBottom: 6,
  },
  list: {
    background: tokens.surface,
    border: `1px solid ${tokens.border}`,
    borderRadius: 8,
    overflow: 'hidden',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    borderBottom: `1px solid ${tokens.surfaceMuted}`,
    gap: 12,
  },
  capInfo: { flex: 1, minWidth: 0 },
  capLabel: { fontSize: 13, fontWeight: 500, color: tokens.textPrimary },
  capMeta: {
    marginTop: 2,
    fontSize: 11,
    color: tokens.textSecondary,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  slug: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 11,
    color: tokens.textTertiary,
  },
  dot: { color: tokens.textTertiary },
  btnGroup: { display: 'flex', alignItems: 'center', gap: 6 },
};
