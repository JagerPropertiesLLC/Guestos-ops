'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function ShortTermPage() {
  const [props, setProps] = useState([]);
  useEffect(() => {
    fetch('/api/sidebar-nav').then(r => r.json()).then(d => {
      setProps((d.properties || []).filter(p => p.module === 'str'));
    });
  }, []);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 28px' }}>
      <h1 style={{ margin: 0, fontSize: 26 }}>Short Term</h1>
      <p style={{ marginTop: 4, color: '#64748b' }}>Casitas En Pueblo — 5 properties, 16 units across multiple LLCs.</p>

      <h2 style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.6, color: '#64748b', marginTop: 32 }}>Properties</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginTop: 12 }}>
        {props.map(p => (
          <Link key={p.id} href={`/short-term/properties/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ padding: 16, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10 }}>
              <div style={{ fontWeight: 600, fontSize: 16 }}>{p.short_name}</div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{p.full_address}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>{p.entity?.name}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
