'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { tokens } from '@/components/settings/_tokens';
import UsersTab from '@/components/settings/UsersTab';
import PropertiesTab from '@/components/settings/PropertiesTab';
import CapabilitiesTab from '@/components/settings/CapabilitiesTab';

export default function SettingsPage() {
  const router = useRouter();
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [includeInactive, setIncludeInactive] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/admin/users${includeInactive ? '?include_inactive=1' : ''}`;
      const r = await fetch(url);
      if (r.status === 403) {
        // Hard redirect per admin spec. Brief delay so the redirect doesn't
        // feel jarring on a fast network.
        setTimeout(() => router.push('/'), 200);
        return;
      }
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(j.error || `HTTP ${r.status}`);
        setLoading(false);
        return;
      }
      const j = await r.json();
      setUsers(j.users || []);
      setLoading(false);
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }, [includeInactive, router]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  return (
    <main style={s.page}>
      <div style={s.header}>
        <h1 style={s.h1}>Settings</h1>
        <p style={s.subtitle}>Users, properties, and permissions.</p>
      </div>

      <div style={s.tabStrip}>
        <Tab active={tab === 'users'}        onClick={() => setTab('users')}>Users</Tab>
        <Tab active={tab === 'properties'}   onClick={() => setTab('properties')}>Properties</Tab>
        <Tab active={tab === 'capabilities'} onClick={() => setTab('capabilities')}>Capabilities</Tab>
      </div>

      {tab === 'users' && (
        <UsersTab
          users={users}
          loading={loading}
          error={error}
          includeInactive={includeInactive}
          setIncludeInactive={setIncludeInactive}
          refetch={fetchUsers}
        />
      )}
      {tab === 'properties'   && <PropertiesTab />}
      {tab === 'capabilities' && <CapabilitiesTab />}
    </main>
  );
}

function Tab({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      background: 'transparent',
      border: 0,
      padding: '10px 16px',
      cursor: 'pointer',
      borderBottom: active ? `2px solid ${tokens.primary}` : '2px solid transparent',
      fontWeight: active ? 600 : 400,
      color: active ? tokens.primaryText : tokens.textSecondary,
      fontSize: 14,
    }}>{children}</button>
  );
}

const s = {
  page: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '24px 20px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  header: { marginBottom: 16 },
  h1: { margin: 0, fontSize: 28, color: tokens.textPrimary },
  subtitle: { margin: '4px 0 0', color: tokens.textSecondary, fontSize: 14 },
  tabStrip: {
    borderBottom: `1px solid ${tokens.border}`,
    margin: '20px 0',
    display: 'flex',
    gap: 4,
  },
};
