'use client';

// components/settings/CapabilitiesTab.js
// Read-only catalog viewer for the capabilities table. Filter by category /
// module / slug variant, full-text search, sortable headers, copy slug to
// clipboard. No edit controls — this is reference UI for granting overrides.

import { useEffect, useState, useMemo } from 'react';
import { Copy, Check, Search, X } from 'lucide-react';
import { tokens } from './_tokens';

const CATEGORY_PILLS = {
  properties:   { bg: tokens.primaryBgTint, fg: tokens.primaryText },
  tenants:      { bg: '#ccfbf1',           fg: '#115e59' }, // teal
  financial:    { bg: tokens.accentBgTint, fg: tokens.accentText }, // gold
  marina:       { bg: '#ede9fe',           fg: '#5b21b6' }, // purple
  construction: { bg: '#e0e7ff',           fg: '#3730a3' }, // indigo
  comms:        { bg: '#e2e8f0',           fg: '#334155' }, // slate
  compliance:   { bg: '#fef3c7',           fg: '#854d0e' }, // amber
  ops:          { bg: tokens.surfaceMuted, fg: '#4b5563' }, // gray
  admin:        { bg: '#fee2e2',           fg: '#991b1b' }, // red
  guests:       { bg: '#cffafe',           fg: '#0e7490' }, // cyan
  contacts:     { bg: '#ffe4e6',           fg: '#9f1239' }, // rose
  documents:    { bg: '#d1fae5',           fg: '#065f46' }, // emerald
};

const MODULE_PILLS = {
  str:          { label: 'STR',          bg: tokens.accentBgTint, fg: tokens.accentText },
  ltr:          { label: 'LTR',          bg: tokens.primaryBgTint, fg: tokens.primaryText },
  construction: { label: 'Construction', bg: '#ccfbf1',           fg: '#115e59' },
  marina:       { label: 'Marina',       bg: '#ede9fe',           fg: '#5b21b6' },
  admin:        { label: 'Admin',        bg: '#fee2e2',           fg: '#991b1b' },
};

const ALL_MODULE_PILL = { label: 'All modules', bg: tokens.surfaceMuted, fg: tokens.textSecondary };

const DESC_TRUNCATE = 80;

const SLUG_VARIANTS = [
  { value: 'all',    label: 'All' },
  { value: 'legacy', label: 'Legacy' },
  { value: 'dotted', label: 'Dotted' },
];

const ROLE_COLS = [
  { key: 'default_owner',   label: 'Owner' },
  { key: 'default_manager', label: 'Manager' },
  { key: 'default_ops',     label: 'Ops' },
  { key: 'default_viewer',  label: 'Viewer' },
];

export default function CapabilitiesTab() {
  const [caps, setCaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [variant, setVariant] = useState('all');
  const [sort, setSort] = useState({ key: 'category', dir: 'asc' });

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetch('/api/admin/capabilities')
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(j => { if (alive) setCaps(j.capabilities || []); })
      .catch(e => { if (alive) setError(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const allCategories = useMemo(
    () => Array.from(new Set(caps.map(c => c.category))).filter(Boolean).sort(),
    [caps]
  );
  const allModules = useMemo(() => {
    const s = new Set();
    for (const c of caps) for (const m of (c.applies_to_modules || [])) s.add(m);
    return Array.from(s).sort();
  }, [caps]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return caps.filter(c => {
      if (categoryFilter && c.category !== categoryFilter) return false;
      if (moduleFilter && !(c.applies_to_modules || []).includes(moduleFilter)) return false;
      if (variant === 'dotted' && !c.slug.includes('.')) return false;
      if (variant === 'legacy' && c.slug.includes('.')) return false;
      if (q) {
        const hay = `${c.slug} ${c.label || ''} ${c.description || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [caps, search, categoryFilter, moduleFilter, variant]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const { key, dir } = sort;
    const mult = dir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      if (key === 'category') {
        const c = (a.category || '').localeCompare(b.category || '') * mult;
        return c !== 0 ? c : (a.slug || '').localeCompare(b.slug || '');
      }
      if (key === 'slug')  return (a.slug || '').localeCompare(b.slug || '') * mult;
      if (key === 'label') return (a.label || '').localeCompare(b.label || '') * mult;
      return 0;
    });
    return arr;
  }, [filtered, sort]);

  function toggleSort(key) {
    setSort(prev => {
      if (prev.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return { key: 'category', dir: 'asc' }; // third click = back to default
    });
  }

  function clearFilters() {
    setSearch(''); setCategoryFilter(''); setModuleFilter(''); setVariant('all');
  }

  const hasActiveFilters = search || categoryFilter || moduleFilter || variant !== 'all';

  return (
    <div>
      <div style={s.controls}>
        <div style={s.searchWrap}>
          <Search size={14} style={s.searchIcon} />
          <input
            type="text"
            placeholder="Search slug, label, description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={s.searchInput}
          />
          {search && (
            <button onClick={() => setSearch('')} style={s.clearBtn} title="Clear search">
              <X size={12} />
            </button>
          )}
        </div>

        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={s.select}>
          <option value="">All categories</option>
          {allCategories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} style={s.select}>
          <option value="">All modules</option>
          {allModules.map(m => (
            <option key={m} value={m}>{(MODULE_PILLS[m] && MODULE_PILLS[m].label) || m}</option>
          ))}
        </select>

        <div style={s.segment}>
          {SLUG_VARIANTS.map(v => (
            <button
              key={v.value}
              onClick={() => setVariant(v.value)}
              style={{
                ...s.segmentBtn,
                background: variant === v.value ? tokens.primary : 'transparent',
                color: variant === v.value ? '#fff' : tokens.textSecondary,
                fontWeight: variant === v.value ? 600 : 400,
              }}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div style={s.countBar}>
        <span>
          Showing <strong>{sorted.length}</strong> of {caps.length} capabilities
        </span>
        {hasActiveFilters && (
          <button onClick={clearFilters} style={s.clearAllBtn}>Clear filters</button>
        )}
      </div>

      {error && <div style={s.errBanner}>Error loading capabilities: {error}</div>}

      {!loading && !error && sorted.length === 0 && (
        <div style={s.empty}>
          <div style={s.emptyTitle}>No capabilities match these filters.</div>
          {hasActiveFilters && (
            <button onClick={clearFilters} style={s.btnPrimary}>Clear filters</button>
          )}
        </div>
      )}

      {(loading || sorted.length > 0) && (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <Th sortable sort={sort} thisKey="slug"     onClick={() => toggleSort('slug')}>Slug</Th>
                <Th sortable sort={sort} thisKey="label"    onClick={() => toggleSort('label')}>Label</Th>
                <Th sortable sort={sort} thisKey="category" onClick={() => toggleSort('category')}>Category</Th>
                <th style={s.th}>Modules</th>
                {ROLE_COLS.map(c => (
                  <th key={c.key} style={s.thCenter}>{c.label}</th>
                ))}
                <th style={s.th}>Description</th>
              </tr>
            </thead>
            <tbody>
              {loading && [1, 2, 3, 4, 5].map(i => (
                <tr key={`skel${i}`}>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <td key={j} style={s.td}><div style={s.skel} /></td>
                  ))}
                </tr>
              ))}
              {!loading && sorted.map(c => (
                <CapRow key={c.id} cap={c} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ sortable, sort, thisKey, onClick, children, style }) {
  const isActive = sort.key === thisKey;
  const arrow = isActive ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : '';
  return (
    <th
      onClick={sortable ? onClick : undefined}
      style={{
        ...s.th,
        cursor: sortable ? 'pointer' : 'default',
        userSelect: 'none',
        color: isActive ? tokens.primaryText : tokens.textSecondary,
        ...style,
      }}
    >
      {children}{arrow}
    </th>
  );
}

function CapRow({ cap }) {
  const [hovered, setHovered] = useState(false);
  const [copied, setCopied] = useState(false);
  const catCfg = CATEGORY_PILLS[cap.category] || { bg: tokens.surfaceMuted, fg: tokens.textSecondary };
  const modules = cap.applies_to_modules;
  const showAll = !modules || modules.length === 0 || modules.includes('*');
  const desc = (cap.description || '').trim();
  const truncated = desc.length > DESC_TRUNCATE ? desc.slice(0, DESC_TRUNCATE) + '…' : desc;

  async function copy() {
    try {
      await navigator.clipboard.writeText(cap.slug);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Older browsers / non-https — silent
    }
  }

  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ background: hovered ? tokens.primaryRowHover : tokens.surface }}
    >
      <td style={s.tdSlug}>
        <span style={s.slug}>{cap.slug}</span>
        <button
          onClick={copy}
          style={{ ...s.copyBtn, opacity: hovered || copied ? 1 : 0 }}
          title={copied ? 'Copied!' : 'Copy slug'}
        >
          {copied ? <Check size={12} style={{ color: '#16a34a' }} /> : <Copy size={12} />}
        </button>
      </td>
      <td style={s.td}>{cap.label || <span style={s.muted}>—</span>}</td>
      <td style={s.td}>
        <span style={{ ...s.pill, background: catCfg.bg, color: catCfg.fg }}>
          {cap.category}
        </span>
      </td>
      <td style={s.td}>
        <div style={s.pillRow}>
          {showAll ? (
            <span style={{ ...s.pill, background: ALL_MODULE_PILL.bg, color: ALL_MODULE_PILL.fg }}>
              {ALL_MODULE_PILL.label}
            </span>
          ) : (
            modules.map(m => {
              const cfg = MODULE_PILLS[m] || { label: m, bg: tokens.surfaceMuted, fg: tokens.textSecondary };
              return (
                <span key={m} style={{ ...s.pill, background: cfg.bg, color: cfg.fg }}>
                  {cfg.label}
                </span>
              );
            })
          )}
        </div>
      </td>
      {ROLE_COLS.map(col => (
        <td key={col.key} style={s.tdCenter}>
          {cap[col.key]
            ? <span style={s.checkOk}>✓</span>
            : <span style={s.muted}>—</span>}
        </td>
      ))}
      <td style={s.tdDesc} title={desc || ''}>
        {desc ? truncated : <span style={s.muted}>—</span>}
      </td>
    </tr>
  );
}

const s = {
  controls: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 12,
    alignItems: 'center',
  },
  searchWrap: { position: 'relative', flex: '1 1 260px', minWidth: 220 },
  searchIcon: { position: 'absolute', left: 10, top: 9, color: tokens.textTertiary },
  searchInput: {
    width: '100%',
    padding: '6px 28px 6px 32px',
    border: `1px solid ${tokens.border}`,
    borderRadius: 6,
    fontSize: 13,
    background: tokens.surface,
  },
  clearBtn: {
    position: 'absolute',
    right: 6,
    top: 6,
    background: 'transparent',
    border: 0,
    cursor: 'pointer',
    color: tokens.textTertiary,
    padding: 4,
    display: 'inline-flex',
  },
  select: {
    padding: '6px 10px',
    border: `1px solid ${tokens.border}`,
    borderRadius: 6,
    fontSize: 13,
    background: tokens.surface,
    color: tokens.textPrimary,
    minWidth: 140,
  },
  segment: {
    display: 'inline-flex',
    border: `1px solid ${tokens.border}`,
    borderRadius: 6,
    overflow: 'hidden',
    background: tokens.surface,
  },
  segmentBtn: {
    padding: '6px 12px',
    border: 0,
    cursor: 'pointer',
    fontSize: 12,
    transition: 'background 0.15s',
  },
  countBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 13,
    color: tokens.textSecondary,
    marginBottom: 8,
  },
  clearAllBtn: {
    background: 'transparent',
    color: tokens.primary,
    border: 0,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
    textDecoration: 'underline',
  },
  errBanner: {
    background: tokens.errorBg,
    color: tokens.errorText,
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
    marginBottom: 12,
  },
  tableWrap: {
    background: tokens.surface,
    border: `1px solid ${tokens.border}`,
    borderRadius: 8,
    overflow: 'auto',
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    padding: 10,
    textAlign: 'left',
    fontSize: 11,
    color: tokens.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    borderBottom: `1px solid ${tokens.border}`,
    fontWeight: 600,
    background: tokens.surface,
    whiteSpace: 'nowrap',
  },
  thCenter: {
    padding: 10,
    textAlign: 'center',
    fontSize: 11,
    color: tokens.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    borderBottom: `1px solid ${tokens.border}`,
    fontWeight: 600,
    background: tokens.surface,
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '10px 10px',
    borderBottom: `1px solid ${tokens.surfaceMuted}`,
    fontSize: 13,
    color: tokens.textPrimary,
    verticalAlign: 'middle',
  },
  tdSlug: {
    padding: '10px 10px',
    borderBottom: `1px solid ${tokens.surfaceMuted}`,
    fontSize: 12,
    color: tokens.textPrimary,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    whiteSpace: 'nowrap',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  tdCenter: {
    padding: '10px 10px',
    borderBottom: `1px solid ${tokens.surfaceMuted}`,
    fontSize: 13,
    textAlign: 'center',
  },
  tdDesc: {
    padding: '10px 10px',
    borderBottom: `1px solid ${tokens.surfaceMuted}`,
    fontSize: 12,
    color: tokens.textSecondary,
    maxWidth: 320,
    lineHeight: 1.4,
  },
  slug: { fontWeight: 500 },
  copyBtn: {
    background: 'transparent',
    border: 0,
    cursor: 'pointer',
    color: tokens.textTertiary,
    padding: 2,
    display: 'inline-flex',
    transition: 'opacity 0.15s',
  },
  pill: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    whiteSpace: 'nowrap',
  },
  pillRow: { display: 'flex', gap: 4, flexWrap: 'wrap' },
  checkOk: { color: tokens.primary, fontWeight: 700 },
  muted: { color: tokens.textTertiary },
  skel: { height: 12, background: tokens.surfaceMuted, borderRadius: 4 },
  empty: {
    background: tokens.surface,
    border: `1px dashed ${tokens.border}`,
    borderRadius: 10,
    padding: 40,
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 14,
    color: tokens.textSecondary,
    marginBottom: 12,
  },
  btnPrimary: {
    background: tokens.primary,
    color: '#fff',
    border: 0,
    padding: '6px 14px',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
  },
};
