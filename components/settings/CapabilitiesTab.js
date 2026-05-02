'use client';

import { tokens } from './_tokens';

export default function CapabilitiesTab() {
  return (
    <div style={s.card}>
      <h2 style={s.title}>Capabilities tab</h2>
      <p style={s.body}>
        Read-only catalog of the 78 capability slugs (62 legacy + 16 dotted RLS
        gates). Built last in the Settings sequence.
      </p>
    </div>
  );
}

const s = {
  card: {
    background: tokens.surface,
    border: `1px dashed ${tokens.border}`,
    borderRadius: 10,
    padding: 40,
    textAlign: 'center',
  },
  title: {
    margin: 0,
    fontSize: 18,
    color: tokens.textPrimary,
    fontWeight: 600,
  },
  body: {
    marginTop: 8,
    color: tokens.textSecondary,
    fontSize: 14,
    maxWidth: 480,
    marginLeft: 'auto',
    marginRight: 'auto',
  },
};
