'use client';

// components/settings/users/AccessSection.js
// Wraps the per-user grant list. Hides grants for super_admin (banner instead).

import { useState } from 'react';
import { ShieldCheck, Plus } from 'lucide-react';
import { tokens } from '@/components/settings/_tokens';
import GrantCard from './GrantCard';
import GrantAccessModal from './GrantAccessModal';

export default function AccessSection({ user, grants, properties, entities, onChanged }) {
  const [showModal, setShowModal] = useState(false);

  if (user.user_type === 'super_admin') {
    return (
      <section style={s.banner}>
        <ShieldCheck size={24} style={{ color: tokens.accent }} />
        <div>
          <div style={s.bannerTitle}>Super admin — full system access</div>
          <div style={s.bannerBody}>
            Super admins bypass all per-property and per-entity grants via the
            <code style={s.code}>is_super_admin()</code> check. No further configuration needed.
          </div>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div style={s.head}>
        <h2 style={s.title}>Access grants</h2>
        <button onClick={() => setShowModal(true)} style={s.addBtn}>
          <Plus size={14} />
          <span>Grant access</span>
        </button>
      </div>

      {grants.length === 0 ? (
        <div style={s.empty}>
          No grants yet. Click <strong>Grant access</strong> to give this user permissions on a specific property or entity.
        </div>
      ) : (
        <div style={s.list}>
          {grants.map(g => (
            <GrantCard
              key={g.id}
              userId={user.id}
              grant={g}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}

      {showModal && (
        <GrantAccessModal
          userId={user.id}
          properties={properties}
          entities={entities}
          onClose={() => setShowModal(false)}
          onCreated={async () => { setShowModal(false); await onChanged(); }}
        />
      )}
    </section>
  );
}

const s = {
  banner: {
    display: 'flex',
    gap: 16,
    background: tokens.accentBgTint,
    border: `1px solid ${tokens.accent}`,
    borderRadius: 10,
    padding: 20,
    alignItems: 'flex-start',
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: tokens.accentText,
  },
  bannerBody: {
    marginTop: 4,
    fontSize: 13,
    color: tokens.accentText,
    lineHeight: 1.5,
  },
  code: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 12,
    background: 'rgba(0,0,0,0.06)',
    padding: '1px 6px',
    borderRadius: 3,
    margin: '0 2px',
  },
  head: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: { margin: 0, fontSize: 16, color: tokens.textPrimary, fontWeight: 600 },
  addBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: tokens.primary,
    color: '#fff',
    border: 0,
    padding: '6px 12px',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
  },
  empty: {
    background: tokens.surface,
    border: `1px dashed ${tokens.border}`,
    borderRadius: 10,
    padding: 24,
    textAlign: 'center',
    color: tokens.textSecondary,
    fontSize: 14,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
};
