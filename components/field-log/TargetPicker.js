// components/field-log/TargetPicker.js
// Property/project picker with recents pinned. Used by capture + inbox tagging.
// Phase 7b: pins units that are actively being cleaned right now to a "Cleaning
// now" group above recents, so Sam can tag photos to her current jobs in one
// tap. Each entry is a property target (with unit_id pre-fill in target.sub_id).
'use client';

import { useEffect, useState } from 'react';
import { Search, Building, Hammer, Sparkles } from 'lucide-react';

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
  const [active, setActive] = useState([]);  // active cleaning units (Phase 7b)
  const [search, setSearch] = useState('');
  const [recents, setRecents] = useState([]);

  useEffect(() => {
    fetch('/api/sidebar-nav').then(r => r.json()).then(setData).catch(() => {});
    fetch('/api/cleaning/active-units').then(r => r.ok ? r.json() : { active_units: [] })
      .then(j => setActive(j.active_units || [])).catch(() => setActive([]));
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

  // Map active cleaning units to property targets, hydrating from sidebar-nav.
  const propsById = Object.fromEntries((data.properties || []).map(p => [p.id, p]));
  const activeTargets = active
    .map(au => {
      // Resolve property id via property_name match (until schedule_units.unit_id backfills).
      const matched = (data.properties || []).find(p => p.short_name === au.property_name);
      if (!matched) return null;
      const unitLabel = au.unit_number ? ` · ${au.unit_number}` : '';
      const status = au.unit_status === 'paused' ? '⏸' : '🟢';
      return {
        kind: 'property',
        id: matched.id,
        name: `${matched.short_name}${unitLabel}`,
        sub: `${status} ${au.unit_status === 'paused' ? 'Paused' : 'Cleaning now'}`,
        unit_id: au.unit_id || null
      };
    })
    .filter(Boolean);

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

      {activeTargets.length > 0 && !search && (
        <Section title="Cleaning now" accent>
          {activeTargets.map((t, i) => <TargetRow key={`active-${i}`} target={t} onClick={() => pick(t)} accent />)}
        </Section>
      )}

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

function Section({ title, children, accent }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={accent ? sectionHeadAccent : sectionHead}>{title}</div>
      <div>{children}</div>
    </div>
  );
}

function TargetRow({ target, onClick, accent }) {
  const Icon = target.kind === 'project' ? Hammer : (accent ? Sparkles : Building);
  return (
    <button onClick={onClick} style={accent ? rowAccent : row}>
      <Icon size={18} style={{ color: accent ? '#1d4ed8' : '#475569' }} />
      <div style={{ flex: 1, textAlign: 'left' }}>
        <div style={{ fontSize: 15, fontWeight: 500 }}>{target.name}</div>
        {target.sub && <div style={{ fontSize: 12, color: accent ? '#1e40af' : '#64748b' }}>{target.sub}</div>}
      </div>
    </button>
  );
}

const searchBar    = { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#f1f5f9', borderRadius: 8 };
const searchInput  = { flex: 1, border: 0, background: 'transparent', outline: 'none', fontSize: 15 };
const sectionHead  = { fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.6, padding: '6px 4px 8px' };
const sectionHeadAccent = { fontSize: 11, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: 0.6, padding: '6px 4px 8px' };
const row = { display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: 12, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 6, cursor: 'pointer' };
const rowAccent = { display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: 12, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, marginBottom: 6, cursor: 'pointer' };
