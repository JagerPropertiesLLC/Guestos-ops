'use client';

// app/settings/users/[id]/page.js
// User detail page. Wraps UserDetailCard + AccessSection.

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { tokens } from '@/components/settings/_tokens';
import UserDetailCard from '@/components/settings/users/UserDetailCard';
import AccessSection from '@/components/settings/users/AccessSection';

export default function UserDetailPage() {
  const router = useRouter();
  const { id } = useParams();

  const [data, setData] = useState(null);
  const [properties, setProperties] = useState([]);
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUser = useCallback(async () => {
    const r = await fetch(`/api/admin/users/${id}`);
    if (r.status === 403) {
      setTimeout(() => router.push('/'), 200);
      return null;
    }
    if (r.status === 404) {
      setError('User not found.');
      return null;
    }
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j.error || `HTTP ${r.status}`);
      return null;
    }
    return await r.json();
  }, [id, router]);

  const refresh = useCallback(async () => {
    const j = await fetchUser();
    if (j) setData(j);
  }, [fetchUser]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      const [u, pRes, eRes] = await Promise.all([
        fetchUser(),
        fetch('/api/admin/properties').then(r => r.ok ? r.json() : { properties: [] }),
        fetch('/api/admin/entities').then(r => r.ok ? r.json() : { entities: [] }),
      ]);
      if (!alive) return;
      if (u) setData(u);
      setProperties(pRes.properties || []);
      setEntities(eRes.entities || []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [fetchUser]);

  if (loading) {
    return (
      <main style={s.page}>
        <BackLink />
        <div style={s.skel}>Loading…</div>
      </main>
    );
  }
  if (error) {
    return (
      <main style={s.page}>
        <BackLink />
        <div style={s.errorBox}>{error}</div>
      </main>
    );
  }
  if (!data) return null;

  return (
    <main style={s.page}>
      <BackLink />
      <UserDetailCard
        user={data.user}
        isSelf={data.is_self}
        isLastSuperAdmin={data.is_last_super_admin}
        onChanged={refresh}
      />
      <AccessSection
        user={data.user}
        grants={data.grants}
        properties={properties}
        entities={entities}
        onChanged={refresh}
      />
    </main>
  );
}

function BackLink() {
  return (
    <Link href="/settings" style={s.back}>
      <ChevronLeft size={16} />
      <span>Back to Settings</span>
    </Link>
  );
}

const s = {
  page: {
    maxWidth: 900,
    margin: '0 auto',
    padding: '24px 20px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  back: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    color: tokens.textSecondary,
    fontSize: 13,
    textDecoration: 'none',
    marginBottom: 16,
  },
  skel: {
    padding: 40,
    textAlign: 'center',
    color: tokens.textTertiary,
  },
  errorBox: {
    padding: 16,
    background: tokens.errorBg,
    color: tokens.errorText,
    borderRadius: 8,
    fontSize: 14,
  },
};
