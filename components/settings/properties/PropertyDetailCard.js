'use client';

// components/settings/properties/PropertyDetailCard.js
// Header card. Read-only display of property metadata.

import { Building2, MapPin } from 'lucide-react';
import { tokens } from '@/components/settings/_tokens';

const TYPE_PILLS = {
  str:          { label: 'STR',          bg: tokens.accentBgTint, fg: tokens.accentText },
  ltr:          { label: 'LTR',          bg: tokens.primaryBgTint, fg: tokens.primaryText },
  construction: { label: 'Construction', bg: '#ccfbf1',           fg: '#115e59' },
  marina:       { label: 'Marina',       bg: '#ede9fe',           fg: '#5b21b6' },
};

export default function PropertyDetailCard({ property }) {
  const headline = property.short_name || property.full_address || '(unnamed property)';
  const subline = property.short_name && property.full_address && property.short_name !== property.full_address
    ? property.full_address
    : null;

  return (
    <section style={s.card}>
      <div style={s.headRow}>
        <div style={s.iconWrap}><Building2 size={22} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={s.name}>{headline}</h1>
          {subline && (
            <div style={s.address}>
              <MapPin size={12} style={{ marginRight: 4, verticalAlign: '-2px' }} />
              {subline}
            </div>
          )}
          {property.entity_name && (
            <div style={s.entity}>Owned by {property.entity_name}</div>
          )}
        </div>
      </div>

      <div style={s.metaGrid}>
        <Stat label="Type">
          <div style={s.pillRow}>
            {(property.property_type || []).length === 0 && <span style={s.muted}>—</span>}
            {(property.property_type || []).map(t => {
              const cfg = TYPE_PILLS[t] || { label: t, bg: tokens.surfaceMuted, fg: tokens.textSecondary };
              return (
                <span key={t} style={{ ...s.pill, background: cfg.bg, color: cfg.fg }}>{cfg.label}</span>
              );
            })}
            {property.is_cam_property && (
              <span style={{ ...s.pill, background: '#fef3c7', color: '#854d0e', border: `1px solid ${tokens.accent}` }}>
                CAM
              </span>
            )}
          </div>
        </Stat>

        <Stat label="Units">
          <div style={s.statValue}>{property.unit_count}</div>
        </Stat>

        <Stat label="Total rentable sq ft">
          <div style={s.statValue}>
            {property.total_rentable_sf
              ? Number(property.total_rentable_sf).toLocaleString()
              : <span style={s.muted}>—</span>}
          </div>
        </Stat>
      </div>
    </section>
  );
}

function Stat({ label, children }) {
  return (
    <div>
      <div style={s.statLabel}>{label}</div>
      {children}
    </div>
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
  headRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 16,
    paddingBottom: 16,
    marginBottom: 20,
    borderBottom: `1px solid ${tokens.surfaceMuted}`,
  },
  iconWrap: {
    background: tokens.primaryBgTint,
    color: tokens.primary,
    width: 44,
    height: 44,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  name: { margin: 0, fontSize: 22, color: tokens.textPrimary, fontWeight: 600 },
  address: { marginTop: 4, fontSize: 13, color: tokens.textSecondary },
  entity: { marginTop: 4, fontSize: 13, color: tokens.primaryText, fontWeight: 500 },
  metaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 24,
  },
  statLabel: {
    fontSize: 11,
    color: tokens.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: 600,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 18,
    color: tokens.textPrimary,
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
  },
  pillRow: { display: 'flex', gap: 4, flexWrap: 'wrap' },
  pill: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  muted: { color: tokens.textTertiary },
};
