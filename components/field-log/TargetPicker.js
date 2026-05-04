// components/field-log/TargetPicker.js
// Property/project picker with recents pinned. Used by capture + inbox tagging.
'use client';

import { useEffect, useState } from 'react';
import { Search, Building, Hammer } from 'lucide-react';

const RECENTS_KEY = 'field_log_recent_targets';

export function loadRecents() {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]'); } catch { return []; }
}

export function saveRecent(target) {
  if (typeof window === 'undefined') return;
  const list = loadRecents().filter(t => t.id !== target.id);
  list.unshift(target);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(list.slice(0, 6)));
}

export default function TargetPicker({ onPick }) {
  const [data, setData] = useState({ properties: [], projects: [] });
  const [search, setSearch] = useState('');
  const [recents, setRecents] = useState([]);

  useEffect(() => {
    fetch('/api/sidebar-nav').then(r => r.json()).then(setData).catch(() => {});
    setRecents(loadRecents());
  }, []);

  function pick(target) {
    saveRecent(target);
    onPick(target);
  }

  const allTargets = [
    ...(data.properties || []).map(p => ({ kind: 'property', id: p.id, name: p.short_name, sub: p.full_address })),
    ...(data.projects   || []).map(p => ({ kind: 'project',  id: p.id, name: p.name }))
  ];

  const filtered = search
    ? allTargets.filter(t => (t.name || '').toLowerCase().includes(search.toLowerCase()))
    : allTargets;

  return (
    <div>
      <div style={searchBar}>
        <Search size={16} style={{ color: '#94a3b8' }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search properties or projects…"
          style={searchInput}
          autoFocus
        />
      </div>

      {recents.length > 0 && !search && (
        <Section title="Recent">
          {recents.map(t => <TargetRow key={t.kind + t.id} target={t} onClick={() => pick(t)} />)}
        </Section>
      )}

      <Section title="All">
        {filtered.map(t => <TargetRow key={t.kind + t.id} target={t} onClick={() => pick(t)} />)}
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={sectionHead}>{title}</div>
      <div>{children}</div>
    </div>
  );
}

function TargetRow({ target, onClick }) {
  const Icon = target.kind === 'project' ? Hammer : Building;
  return (
    <button onClick={onClick} style={row}>
      <Icon size={18} style={{ color: '#475569' }} />
      <div style={{ flex: 1, textAlign: 'left' }}>
        <div style={{ fontSize: 15, fontWeight: 500 }}>{target.name}</div>
        {target.sub && <div style={{ fontSize: 12, color: '#64748b' }}>{target.sub}</div>}
      </div>
    </button>
  );
}

const searchBar    = { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#f1f5f9', borderRadius: 8 };
const searchInput  = { flex: 1, border: 0, background: 'transparent', outline: 'none', fontSize: 15 };
const sectionHead  = { fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.6, padding: '6px 4px 8px' };
const row = { display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: 12, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 6, cursor: 'pointer' };
