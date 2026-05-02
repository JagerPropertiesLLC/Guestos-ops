'use client';

// components/construction/ProjectStubSection.js
// Placeholder section for project detail areas not yet built. Keeps the page
// architecturally complete in phase 1 — sections light up in later phases.

import { tokens } from './_tokens';

export default function ProjectStubSection({ title, phase, description, icon: Icon }) {
  return (
    <section style={s.card}>
      <div style={s.head}>
        {Icon && <Icon size={18} style={{ color: tokens.textTertiary }} />}
        <div style={{ flex: 1 }}>
          <h2 style={s.title}>{title}</h2>
          {description && <div style={s.body}>{description}</div>}
        </div>
        <span style={s.phaseTag}>Coming in {phase}</span>
      </div>
    </section>
  );
}

const s = {
  card: {
    background: tokens.surface,
    border: `1px dashed ${tokens.border}`,
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
  },
  head: { display: 'flex', alignItems: 'flex-start', gap: 12 },
  title: { margin: 0, fontSize: 14, color: tokens.textPrimary, fontWeight: 600 },
  body: { marginTop: 4, fontSize: 12, color: tokens.textSecondary, lineHeight: 1.5 },
  phaseTag: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    background: tokens.accentBgTint,
    color: tokens.accentText,
    whiteSpace: 'nowrap',
  },
};
