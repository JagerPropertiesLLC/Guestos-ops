'use client';

import { tokens } from './_tokens';

const ROLES = {
  super_admin: { label: 'Super admin', bg: tokens.accentBgTint,  text: tokens.accentText },
  owner:       { label: 'Owner',       bg: tokens.primaryBgTint, text: tokens.primaryText },
  manager:     { label: 'Manager',     bg: '#ccfbf1',            text: '#115e59' },
  staff:       { label: 'Staff',       bg: tokens.surfaceMuted,  text: '#4b5563' },
};

export default function RolePill({ userType }) {
  const cfg = ROLES[userType] || {
    label: userType || 'unknown',
    bg: tokens.surfaceMuted,
    text: tokens.textSecondary,
  };
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 10px',
      borderRadius: 12,
      fontSize: 12,
      fontWeight: 500,
      background: cfg.bg,
      color: cfg.text,
      whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  );
}
