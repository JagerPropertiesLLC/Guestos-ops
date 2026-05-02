'use client';

import { tokens } from './_tokens';

export default function PropertiesTab() {
  return (
    <div style={s.card}>
      <h2 style={s.title}>Properties tab</h2>
      <p style={s.body}>
        Property list and per-property access management. Built after the Users
        detail page lands. Coming next.
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
