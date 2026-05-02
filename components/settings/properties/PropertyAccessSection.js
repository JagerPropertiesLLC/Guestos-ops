'use client';

// components/settings/properties/PropertyAccessSection.js
// Composes super-admin banner + direct-access list + indirect-access list +
// "+ Grant access" button. Mirrors AccessSection but property-centric.

import { useState } from 'react';
import { ShieldCheck, Plus } from 'lucide-react';
import { tokens } from '@/components/settings/_tokens';
import UserAccessCard from './UserAccessCard';
import IndirectAccessRow from './IndirectAccessRow';
import PropertyGrantUserModal from './PropertyGrantUserModal';

export default function PropertyAccessSection({
  property, superAdmins, directAccess, indirectAccess, allUsers, onChanged,
}) {
  const [showModal, setShowModal] = useState(false);

  const directUserIds = new Set(directAccess.map(d => d.user.id));

  const eligibleUsers = (allUsers || [])
    .filter(u => u.active)
    .filter(u => u.user_type !== 'super_admin')
    .filter(u => !directUserIds.has(u.id));

  const hiddenAlreadyGranted = (allUsers || [])
    .filter(u => u.active)
    .filter(u => u.user_type !== 'super_admin')
    .filter(u => directUserIds.has(u.id))
    .length;

  const hasAnyAccess = (superAdmins?.length || 0) + directAccess.length + indirectAccess.length > 0;

  return (
    <section>
      {(superAdmins || []).length > 0 && (
        <div style={s.banner}>
          <ShieldCheck size={20} style={{ color: tokens.accent, marginTop: 2 }} />
          <div>
            <div style={s.bannerTitle}>
              Super admin{superAdmins.length > 1 ? 's' : ''} ({superAdmins.length}) — full access
            </div>
            <div style={s.bannerBody}>
              {superAdmins.map((sa, i) => (
                <span key={sa.id}>
                  {i > 0 && ', '}
                  <strong>{sa.full_name || sa.email}</strong>
                  {sa.full_name && <span style={{ color: tokens.accentText, opacity: 0.7 }}> · {sa.email}</span>}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={s.head}>
        <h2 style={s.title}>Users with access</h2>
        <button onClick={() => setShowModal(true)} style={s.addBtn}>
          <Plus size={14} />
          <span>Grant access</span>
        </button>
      </div>

      {!hasAnyAccess && (
        <div style={s.empty}>
          No users have been granted access. Click <strong>Grant access</strong> to give a user permissions on this property.
        </div>
      )}

      {directAccess.length > 0 && (
        <>
          <div style={s.subtitle}>Direct grants ({directAccess.length})</div>
          <div style={s.list}>
            {directAccess.map(({ user, grant }) => (
              <UserAccessCard
                key={user.id}
                user={user}
                grant={grant}
                onChanged={onChanged}
              />
            ))}
          </div>
        </>
      )}

      {indirectAccess.length > 0 && (
        <>
          <div style={{ ...s.subtitle, marginTop: directAccess.length > 0 ? 20 : 0 }}>
            Indirect access ({indirectAccess.length})
            <span style={s.subtitleHint}> — managed at the user or entity level</span>
          </div>
          <div style={s.list}>
            {indirectAccess.map((row) => (
              <IndirectAccessRow key={`${row.user.id}-${row.source}`} row={row} />
            ))}
          </div>
        </>
      )}

      {showModal && (
        <PropertyGrantUserModal
          property={property}
          eligibleUsers={eligibleUsers}
          hiddenAlreadyGranted={hiddenAlreadyGranted}
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
    gap: 12,
    background: tokens.accentBgTint,
    border: `1px solid ${tokens.accent}`,
    borderRadius: 10,
    padding: 14,
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  bannerTitle: { fontSize: 14, fontWeight: 600, color: tokens.accentText },
  bannerBody: { marginTop: 4, fontSize: 13, color: tokens.accentText, lineHeight: 1.5 },
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
  subtitle: {
    fontSize: 11,
    color: tokens.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: 600,
    marginBottom: 8,
  },
  subtitleHint: {
    textTransform: 'none',
    fontWeight: 400,
    letterSpacing: 0,
    fontStyle: 'italic',
    color: tokens.textTertiary,
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
  list: { display: 'flex', flexDirection: 'column', gap: 12 },
};
