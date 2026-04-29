'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function TeamListPage() {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    load();
  }, [showInactive]);

  async function load() {
    setLoading(true);
    let q = supabase.from('dream_team').select('*').order('display_name');
    if (!showInactive) q = q.eq('active', true);
    const { data } = await q;
    setTeam(data || []);
    setLoading(false);
  }

  return (
    <main style={styles.page}>
      <div style={styles.header}>
        <a href="/tasks" style={styles.backLink}>← Back</a>
        <div style={styles.headerRow}>
          <h1 style={styles.h1}>Dream Team</h1>
          <a href="/team/new" style={styles.newBtn}>+ Add member</a>
        </div>
        <p style={styles.subtitle}>Internal team members who get assigned tasks.</p>
      </div>

      <label style={styles.toggleRow}>
        <input
          type="checkbox"
          checked={showInactive}
          onChange={(e) => setShowInactive(e.target.checked)}
        />
        Show inactive members
      </label>

      {loading ? (
        <div style={styles.loading}>Loading...</div>
      ) : team.length === 0 ? (
        <div style={styles.empty}>No team members yet.</div>
      ) : (
        <div style={styles.list}>
          {team.map((m) => (
            <a key={m.id} href={`/team/${m.id}`} style={styles.card}>
              <div style={styles.cardLeft}>
                <div style={styles.name}>{m.display_name}</div>
                <div style={styles.role}>{m.role.replace(/_/g, ' ')}</div>
                {(m.phone || m.email) && (
                  <div style={styles.contact}>
                    {m.phone || ''}{m.phone && m.email ? ' · ' : ''}{m.email || ''}
                  </div>
                )}
              </div>
              {!m.active && <span style={styles.inactiveBadge}>inactive</span>}
            </a>
          ))}
        </div>
      )}
    </main>
  );
}

const styles = {
  page: { maxWidth: 720, margin: '0 auto', padding: '20px 16px 60px', fontFamily: 'system-ui, -apple-system, sans-serif' },
  header: { marginBottom: 20 },
  backLink: { fontSize: 14, color: '#6b7280', textDecoration: 'none' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  h1: { fontSize: 26, margin: 0, fontWeight: 600 },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 6 },
  newBtn: { background: '#0f6e56', color: 'white', textDecoration: 'none', padding: '10px 16px', borderRadius: 8, fontSize: 14, fontWeight: 500 },
  toggleRow: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#6b7280', marginBottom: 16 },
  loading: { padding: 40, textAlign: 'center', color: '#6b7280' },
  empty: { padding: 40, textAlign: 'center', color: '#6b7280' },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  card: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, textDecoration: 'none', color: 'inherit' },
  cardLeft: { display: 'flex', flexDirection: 'column', gap: 4 },
  name: { fontSize: 16, fontWeight: 500, color: '#111827' },
  role: { fontSize: 13, color: '#6b7280', textTransform: 'capitalize' },
  contact: { fontSize: 12, color: '#9ca3af' },
  inactiveBadge: { fontSize: 11, padding: '3px 8px', background: '#f3f4f6', color: '#6b7280', borderRadius: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
};
