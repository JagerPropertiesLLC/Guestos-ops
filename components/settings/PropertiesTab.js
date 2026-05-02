'use client';

// components/settings/PropertiesTab.js
// Grid of all properties. Click a row to open detail at /settings/properties/[id].

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { tokens } from './_tokens';

const TYPE_PILLS = {
  str:          { label: 'STR',          bg: tokens.accentBgTint, fg: tokens.accentText },
  ltr:          { label: 'LTR',          bg: tokens.primaryBgTint, fg: tokens.primaryText },
  construction: { label: 'Construction', bg: '#ccfbf1',           fg: '#115e59' },
  marina:       { label: 'Marina',       bg: '#ede9fe',           fg: '#5b21b6' },
};

export default function PropertiesTab() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/admin/properties');
      if (r.status === 403) {
        setTimeout(() => router.push('/'), 200);
        return;
      }
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setRows(j.properties || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  return (
    <div>
      {error && (
        <div style={s.errBanner}>
          <span>Error loading properties: {error}</span>
          <button onClick={fetchRows} style={s.retry}>Retry</button>
        </div>
      )}

      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>Property</th>
            <th style={s.th}>Type</th>
            <th style={s.thNum}>Units</th>
            <th
              style={s.thNum}
              title="Users with a direct grant on this property. Indirect access (entity grants + stakeholders) is shown on the property detail page."
            >
              Direct users
            </th>
          </tr>
        </thead>
        <tbody>
          {loading && [1, 2, 3].map(i => (
            <tr key={`skel${i}`}>
              {[1, 2, 3, 4].map(j => (
                <td key={j} style={s.td}><div style={s.skel} /></td>
              ))}
            </tr>
          ))}

          {!loading && !error && rows.length === 0 && (
            <tr><td colSpan={4} style={s.empty}>No properties yet.</td></tr>
          )}

          {!loading && rows.map(p => (
            <tr
              key={p.id}
              onClick={() => router.push(`/settings/properties/${p.id}`)}
              onMouseEnter={(e) => { e.currentTarget.style.background = tokens.primaryRowHover; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = tokens.surface; }}
              style={s.row}
            >
              <td style={s.td}>
                <div style={s.propName}>{p.short_name || p.full_address || '(unnamed)'}</div>
                <div style={s.propMeta}>
                  {p.entity_name ? `${p.entity_name} · ` : ''}{p.full_address}
                </div>
              </td>
              <td style={s.td}>
                <div style={s.pillRow}>
                  {(p.property_type || []).map(t => {
                    const cfg = TYPE_PILLS[t] || { label: t, bg: tokens.surfaceMuted, fg: tokens.textSecondary };
                    return (
                      <span key={t} style={{ ...s.pill, background: cfg.bg, color: cfg.fg }}>
                        {cfg.label}
                      </span>
                    );
                  })}
                  {p.is_cam_property && (
                    <span style={{ ...s.pill, background: '#fef3c7', color: '#854d0e', border: `1px solid ${tokens.accent}` }}>
                      CAM
                    </span>
                  )}
                </div>
              </td>
              <td style={s.tdNum}>{p.unit_count || <span style={{ color: tokens.textTertiary }}>—</span>}</td>
              <td style={s.tdNum}>
                {p.direct_user_count > 0
                  ? p.direct_user_count
                  : <span style={{ color: tokens.textTertiary }}>—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const s = {
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    background: tokens.surface,
    border: `1px solid ${tokens.border}`,
    borderRadius: 8,
    overflow: 'hidden',
  },
  th: {
    padding: 12,
    textAlign: 'left',
    fontSize: 11,
    color: tokens.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    borderBottom: `1px solid ${tokens.border}`,
    fontWeight: 600,
    background: tokens.surface,
  },
  thNum: {
    padding: 12,
    textAlign: 'right',
    fontSize: 11,
    color: tokens.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    borderBottom: `1px solid ${tokens.border}`,
    fontWeight: 600,
    background: tokens.surface,
  },
  row: { cursor: 'pointer', transition: 'background 0.15s', background: tokens.surface },
  td: {
    padding: 12,
    borderBottom: `1px solid ${tokens.surfaceMuted}`,
    fontSize: 14,
    color: tokens.textPrimary,
  },
  tdNum: {
    padding: 12,
    borderBottom: `1px solid ${tokens.surfaceMuted}`,
    fontSize: 14,
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
    color: tokens.textPrimary,
  },
  propName: { fontWeight: 600, color: tokens.textPrimary },
  propMeta: { fontSize: 12, color: tokens.textSecondary, marginTop: 2 },
  pillRow: { display: 'flex', gap: 4, flexWrap: 'wrap' },
  pill: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  skel: { height: 14, background: tokens.surfaceMuted, borderRadius: 4 },
  empty: { padding: 40, textAlign: 'center', color: tokens.textSecondary, fontSize: 14 },
  errBanner: {
    background: tokens.errorBg,
    color: tokens.errorText,
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
    marginBottom: 12,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  retry: {
    background: tokens.errorText,
    color: '#fff',
    border: 0,
    padding: '4px 10px',
    borderRadius: 4,
    fontSize: 12,
    cursor: 'pointer',
  },
};
