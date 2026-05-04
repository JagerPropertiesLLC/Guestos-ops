// components/CompanyPicker.js
// Typeahead picker for companies with inline "Create new" option.
// Use case: replacing free-text vendor name in modals (Subcontract, Inspection,
// Change Order, Expense). Returns the selected company's id + name via onChange.
'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Building2, X } from 'lucide-react';

export default function CompanyPicker({
  value,            // { id, name } | null
  onChange,         // (company | null) => void
  typeFilter,       // 'sub' | 'general_contractor' | etc.; null for any
  placeholder = 'Search companies…',
  marketFilter
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open || query.length < 1) { setResults([]); return; }
    const timer = setTimeout(async () => {
      const params = new URLSearchParams({ q: query, limit: '8' });
      if (typeFilter)   params.set('type', typeFilter);
      if (marketFilter) params.set('market', marketFilter);
      const r = await fetch(`/api/companies?${params}`);
      const j = await r.json();
      setResults(j.companies || []);
    }, 180);
    return () => clearTimeout(timer);
  }, [query, open, typeFilter, marketFilter]);

  function pick(c) {
    onChange({ id: c.id, name: c.name, type: c.type });
    setQuery('');
    setResults([]);
    setOpen(false);
  }

  function clear() {
    onChange(null);
    setQuery('');
    setOpen(false);
  }

  if (value && !creating) {
    return (
      <div style={selectedRow}>
        <Building2 size={14} style={{ color: '#475569' }} />
        <span style={{ flex: 1 }}>{value.name}</span>
        <button type="button" onClick={clear} style={iconBtn}><X size={14} /></button>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        style={input}
      />
      {open && (results.length > 0 || query.length > 0) && (
        <div style={dropdown}>
          {results.map(c => (
            <div key={c.id} onMouseDown={() => pick(c)} style={dropdownRow}>
              <Building2 size={14} style={{ color: '#475569' }} />
              <span style={{ flex: 1 }}>{c.name}</span>
              {c.type && <span style={typePill}>{c.type}</span>}
            </div>
          ))}
          {query.length > 0 && (
            <div onMouseDown={() => setCreating(true)} style={{ ...dropdownRow, color: '#0f172a', fontWeight: 500 }}>
              <Plus size={14} /> Create "{query}"
            </div>
          )}
        </div>
      )}
      {creating && (
        <CreateCompanyInline
          initialName={query}
          defaultType={typeFilter}
          onCreated={(c) => { setCreating(false); pick(c); }}
          onCancel={() => setCreating(false)}
        />
      )}
    </div>
  );
}

function CreateCompanyInline({ initialName, defaultType, onCreated, onCancel }) {
  const [name, setName] = useState(initialName);
  const [type, setType] = useState(defaultType || 'sub');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!name.trim()) return;
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, type, primary_market_slug: 'pueblo' })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      onCreated(j.company);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={createCard}>
      <div style={{ fontSize: 12, color: '#475569', marginBottom: 6 }}>New company</div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Company name" style={input} autoFocus />
      <select value={type} onChange={(e) => setType(e.target.value)} style={{ ...input, marginTop: 6 }}>
        <option value="general_contractor">General contractor</option>
        <option value="sub">Subcontractor</option>
        <option value="engineer">Engineer</option>
        <option value="architect">Architect</option>
        <option value="inspector">Inspector</option>
        <option value="agency">Agency / authority</option>
        <option value="utility">Utility</option>
        <option value="supplier">Supplier</option>
        <option value="other">Other</option>
      </select>
      {error && <div style={{ color: '#b91c1c', fontSize: 12, marginTop: 6 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={btnSecondary}>Cancel</button>
        <button type="button" onClick={submit} disabled={busy || !name.trim()} style={btnPrimary}>
          {busy ? 'Saving…' : 'Create'}
        </button>
      </div>
    </div>
  );
}

const input = { width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' };
const dropdown = {
  position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
  background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6,
  boxShadow: '0 6px 16px rgba(15,23,42,0.08)', zIndex: 30, maxHeight: 240, overflowY: 'auto'
};
const dropdownRow = { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', cursor: 'pointer', fontSize: 14, borderTop: '1px solid #f1f5f9' };
const selectedRow = { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, background: '#f8fafc', fontSize: 14 };
const iconBtn = { background: 'transparent', border: 0, color: '#64748b', cursor: 'pointer', display: 'inline-flex' };
const typePill = { fontSize: 11, padding: '2px 6px', background: '#f1f5f9', color: '#475569', borderRadius: 4 };
const createCard = { marginTop: 8, padding: 12, border: '1px solid #cbd5e1', background: '#fff', borderRadius: 6 };
const btnPrimary = { background: '#0f172a', color: '#fff', border: 0, padding: '6px 12px', borderRadius: 5, fontSize: 13, cursor: 'pointer' };
const btnSecondary = { background: '#fff', color: '#475569', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: 5, fontSize: 13, cursor: 'pointer' };
