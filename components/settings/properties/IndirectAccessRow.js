'use client';

// components/settings/properties/IndirectAccessRow.js
// Read-only row for users whose access flows from an entity grant or
// stakeholder relationship. Click name → user detail page (where it can be
// managed at the source).

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { tokens } from '@/components/settings/_tokens';
import RolePill from '@/components/settings/RolePill';

const SOURCE_DOT = {
  entity_grant: { color: tokens.primary,   label: 'entity grant' },
  stakeholder:  { color: tokens.textTertiary, label: 'stakeholder' },
};

export default function IndirectAccessRow({ row }) {
  const dot = SOURCE_DOT[row.source] || { color: tokens.textTertiary, label: row.source };

  return (
    <Link href={`/settings/users/${row.user.id}`} style={s.linkWrap}>
      <div style={s.row}>
        <div style={s.userWrap}>
          <span style={{ ...s.dot, background: dot.color }} title={dot.label} />
          <div style={{ minWidth: 0 }}>
            <div style={s.userName}>{row.user.full_name || '(no name)'}</div>
            <div style={s.userEmail}>{row.user.email}</div>
          </div>
        </div>

        <div style={s.sourceWrap}>
          <RolePill userType={row.user.user_type} />
          <div style={s.sourceLabel}>{row.source_label}</div>
        </div>

        <div style={s.cta}>
          <span style={s.manage}>Manage</span>
          <ExternalLink size={12} />
        </div>
      </div>
    </Link>
  );
}

const s = {
  linkWrap: { textDecoration: 'none', color: 'inherit' },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr auto auto',
    alignItems: 'center',
    gap: 16,
    padding: 14,
    background: tokens.surfaceMuted,
    border: `1px solid ${tokens.border}`,
    borderRadius: 10,
    transition: 'background 0.15s',
    cursor: 'pointer',
  },
  userWrap: { display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  userName: {
    fontSize: 14,
    fontWeight: 500,
    color: tokens.textPrimary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  userEmail: {
    fontSize: 12,
    color: tokens.textSecondary,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    marginTop: 2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  sourceWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
  },
  sourceLabel: {
    fontSize: 11,
    color: tokens.textSecondary,
    fontStyle: 'italic',
  },
  cta: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    color: tokens.textTertiary,
    fontSize: 12,
  },
  manage: { fontWeight: 500 },
};
