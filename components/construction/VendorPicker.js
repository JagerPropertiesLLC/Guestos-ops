'use client';

// components/construction/VendorPicker.js
// Autocomplete vendor selector with create-on-the-fly. Reuses the companies
// table — first time a vendor name is typed and committed, a row is created;
// subsequent uses match by case-insensitive name.

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { tokens } from './_tokens';

export default function VendorPicker({ value, onChange, placeholder = 'Vendor (start typing…)' }) {
  // value: { id, name } or null
  const [query, setQuery] = useState(value?.name || '');
  const [matches, setMatches] = useState([]);
  const [showMenu, setShowMenu] = useState(false);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const debounceRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => { setQuery(value?.name || ''); }, [value?.id, value?.name]);

  useEffect(() => {
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowMenu(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function search(q) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(`/api/construction/companies?q=${encodeURIComponent(q)}&limit=10`);
        const j = await r.json();
        setMatches(j.companies || []);
      } catch {
        setMatches([]);
      } finally {
        setSearching(false);
      }
    }, 200);
  }

  function pick(co) {
    onChange({ id: co.id, name: co.name });
    setQuery(co.name);
    setShowMenu(false);
  }

  async function createNew() {
    const name = query.trim();
    if (!name) return;
    setCreating(true);
    try {
      const r = await fetch('/api/construction/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type: 'vendor' }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      pick(j.company);
    } catch (e) {
      alert(`Could not create vendor: ${e.message}`);
    } finally {
      setCreating(false);
    }
  }

  const exactMatch = matches.find(m => m.name.toLowerCase() === query.trim().toLowerCase());
  const showCreate = query.trim().length > 0 && !exactMatch && !searching;

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          search(e.target.value);
          setShowMenu(true);
          if (value?.id && e.target.value !== value.name) onChange(null);
        }}
        onFocus={() => { search(query); setShowMenu(true); }}
        placeholder={placeholder}
        style={s.input}
      />
      {showMenu && (matches.length > 0 || showCreate || searching) && (
        <div style={s.menu}>
          {searching && <div style={s.menuMuted}><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Searching…</div>}
          {matches.map(m => (
            <div key={m.id} onMouseDown={() => pick(m)} style={s.menuItem}>
              <span>{m.name}</span>
              {m.type && <span style={s.menuTag}>{m.type}</span>}
            </div>
          ))}
          {showCreate && (
            <div onMouseDown={createNew} style={{ ...s.menuItem, borderTop: matches.length ? `1px solid ${tokens.border}` : 0, color: tokens.primary, fontWeight: 500 }}>
              {creating ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite', marginRight: 6 }} />Creating…</> : <>+ Create &quot;{query.trim()}&quot;</>}
            </div>
          )}
        </div>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const s = {
  input: {
    width: '100%',
    padding: '8px 10px',
    border: `1px solid ${tokens.border}`,
    borderRadius: 6,
    fontSize: 14,
    background: tokens.surface,
    color: tokens.textPrimary,
    fontFamily: 'inherit',
  },
  menu: {
    position: 'absolute',
    top: 'calc(100% + 2px)',
    left: 0,
    right: 0,
    background: tokens.surface,
    border: `1px solid ${tokens.border}`,
    borderRadius: 6,
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    zIndex: 10,
    maxHeight: 240,
    overflowY: 'auto',
  },
  menuItem: {
    padding: '8px 10px',
    cursor: 'pointer',
    fontSize: 13,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  menuMuted: {
    padding: '8px 10px',
    fontSize: 12,
    color: tokens.textTertiary,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  menuTag: {
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: tokens.textTertiary,
    background: tokens.surfaceMuted,
    padding: '1px 6px',
    borderRadius: 8,
  },
};
