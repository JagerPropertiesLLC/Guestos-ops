'use client';

import { useRouter } from 'next/navigation';
import { tokens } from './_tokens';
import RolePill from './RolePill';

export default function UsersTab({
  users,
  loading,
  error,
  includeInactive,
  setIncludeInactive,
  refetch,
}) {
  const router = useRouter();

  function handleAddUser() {
    alert(
      'User creation comes after Supabase Auth is wired. ' +
      'For now, manage existing users at /settings/users/[id] (next step).'
    );
  }

  return (
    <div>
      <div style={s.controls}>
        <label style={s.toggle}>
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
          />
          Show inactive
        </label>
        <button onClick={handleAddUser} style={s.btnPrimary}>+ Add user</button>
      </div>

      {error && (
        <div style={s.errorBanner}>
          <span>Error loading users: {error}</span>
          <button onClick={refetch} style={s.retryBtn}>Retry</button>
        </div>
      )}

      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>Name</th>
            <th style={s.th}>Email</th>
            <th style={s.th}>Role</th>
            <th style={s.thCenter}>Portal</th>
            <th style={s.thNum}>Property access</th>
            <th style={s.thNum}>Entity access</th>
          </tr>
        </thead>
        <tbody>
          {loading && [1, 2, 3].map((i) => (
            <tr key={`skel${i}`}>
              {[1,2,3,4,5,6].map((j) => (
                <td key={j} style={s.td}><div style={s.skelBar} /></td>
              ))}
            </tr>
          ))}
          {!loading && !error && users.length === 0 && (
            <tr>
              <td colSpan={6} style={s.empty}>No users yet.</td>
            </tr>
          )}
          {!loading && users.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              onClick={() => router.push(`/settings/users/${u.id}`)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserRow({ user, onClick }) {
  return (
    <tr
      onClick={onClick}
      onMouseEnter={(e) => { e.currentTarget.style.background = tokens.primaryRowHover; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = tokens.surface; }}
      style={s.row}
    >
      <td style={s.td}>
        <span style={{
          color: user.active ? tokens.textPrimary : tokens.textTertiary,
          fontWeight: 500,
        }}>{user.full_name || '—'}</span>
        {!user.active && <span style={s.inactiveBadge}>inactive</span>}
      </td>
      <td style={s.tdMono}>{user.email}</td>
      <td style={s.td}><RolePill userType={user.user_type} /></td>
      <td style={s.tdCenter}>
        {user.has_portal_access
          ? <span style={{ color: tokens.primary, fontWeight: 600 }}>✓</span>
          : <span style={{ color: tokens.textTertiary }}>—</span>}
      </td>
      <td style={s.tdNum}>{formatGrantCount(user.property_grant_count)}</td>
      <td style={s.tdNum}>{formatGrantCount(user.entity_grant_count)}</td>
    </tr>
  );
}

function formatGrantCount(n) {
  if (n === null) return <span style={{ color: tokens.accentText, fontWeight: 600 }}>All</span>;
  if (n === 0)    return <span style={{ color: tokens.textTertiary }}>—</span>;
  return n;
}

const s = {
  controls: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  toggle: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 14,
    color: tokens.textSecondary,
  },
  btnPrimary: {
    background: tokens.primary,
    color: '#fff',
    border: 0,
    padding: '8px 16px',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    background: tokens.surface,
    border: `1px solid ${tokens.border}`,
    borderRadius: 8,
    overflow: 'hidden',
  },
  th: {
    padding: '12px',
    textAlign: 'left',
    fontSize: 11,
    color: tokens.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    borderBottom: `1px solid ${tokens.border}`,
    fontWeight: 600,
    background: tokens.surface,
  },
  thCenter: {
    padding: '12px',
    textAlign: 'center',
    fontSize: 11,
    color: tokens.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    borderBottom: `1px solid ${tokens.border}`,
    fontWeight: 600,
    background: tokens.surface,
  },
  thNum: {
    padding: '12px',
    textAlign: 'right',
    fontSize: 11,
    color: tokens.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    borderBottom: `1px solid ${tokens.border}`,
    fontWeight: 600,
    background: tokens.surface,
  },
  row: {
    cursor: 'pointer',
    transition: 'background 0.15s',
    background: tokens.surface,
  },
  td: {
    padding: '12px',
    borderBottom: `1px solid ${tokens.surfaceMuted}`,
    fontSize: 14,
    color: tokens.textPrimary,
  },
  tdMono: {
    padding: '12px',
    borderBottom: `1px solid ${tokens.surfaceMuted}`,
    fontSize: 13,
    color: tokens.textSecondary,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  tdCenter: {
    padding: '12px',
    borderBottom: `1px solid ${tokens.surfaceMuted}`,
    fontSize: 14,
    textAlign: 'center',
  },
  tdNum: {
    padding: '12px',
    borderBottom: `1px solid ${tokens.surfaceMuted}`,
    fontSize: 14,
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
    color: tokens.textPrimary,
  },
  inactiveBadge: {
    display: 'inline-block',
    marginLeft: 8,
    fontSize: 10,
    padding: '2px 6px',
    background: tokens.surfaceMuted,
    color: tokens.textSecondary,
    borderRadius: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  empty: {
    padding: 40,
    textAlign: 'center',
    color: tokens.textSecondary,
    fontSize: 14,
  },
  skelBar: {
    height: 14,
    background: tokens.surfaceMuted,
    borderRadius: 4,
  },
  errorBanner: {
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
  retryBtn: {
    background: tokens.errorText,
    color: '#fff',
    border: 0,
    padding: '4px 10px',
    borderRadius: 4,
    fontSize: 12,
    cursor: 'pointer',
  },
};
