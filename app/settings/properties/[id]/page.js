'use client';

// app/settings/properties/[id]/page.js
// Property detail page. Mirrors /settings/users/[id] but inverted to show all
// users (direct + indirect + super-admin) who can access this property.

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { tokens } from '@/components/settings/_tokens';
import PropertyDetailCard from '@/components/settings/properties/PropertyDetailCard';
import PropertyAccessSection from '@/components/settings/properties/PropertyAccessSection';

export default function PropertyDetailPage() {
  const router = useRouter();
  const { id } = useParams();

  const [data, setData] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProperty = useCallback(async () => {
    const r = await fetch(`/api/admin/properties/${id}`);
    if (r.status === 403) {
      setTimeout(() => router.push('/'), 200);
      return null;
    }
    if (r.status === 404) {
      setError('Property not found.');
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
    const j = await fetchProperty();
    if (j) setData(j);
  }, [fetchProperty]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      const [p, uRes] = await Promise.all([
        fetchProperty(),
        fetch('/api/admin/users').then(r => r.ok ? r.json() : { users: [] }),
      ]);
      if (!alive) return;
      if (p) setData(p);
      setAllUsers(uRes.users || []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [fetchProperty]);

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
      <PropertyDetailCard property={data.property} />
      <PropertyAccessSection
        property={data.property}
        superAdmins={data.super_admins}
        directAccess={data.direct_access}
        indirectAccess={data.indirect_access}
        allUsers={allUsers}
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
  skel: { padding: 40, textAlign: 'center', color: tokens.textTertiary },
  errorBox: {
    padding: 16,
    background: tokens.errorBg,
    color: tokens.errorText,
    borderRadius: 8,
    fontSize: 14,
  },
};
