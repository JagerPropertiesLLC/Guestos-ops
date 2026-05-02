'use client';

import { tokens, STATUS_COLORS } from './_tokens';

export default function StatusPill({ status }) {
  const cfg = STATUS_COLORS[status] || { bg: tokens.surfaceMuted, fg: tokens.textSecondary };
  const label = (status || 'unknown').replace(/_/g, ' ');
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 10px',
      borderRadius: 12,
      fontSize: 11,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      background: cfg.bg,
      color: cfg.fg,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}
