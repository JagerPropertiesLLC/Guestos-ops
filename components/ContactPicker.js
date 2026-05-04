// components/ContactPicker.js
// Typeahead picker for contacts (people). Inline create option. Optionally
// scoped to a company via companyId, in which case the dropdown shows people
// at that company first.
'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, User, X } from 'lucide-react';

export default function ContactPicker({
  value,            // { id, first_name, last_name, ...} | null
  onChange,         // (contact | null) => void
  companyId,        // optional: scope to a company
  placeholder = 'Search contacts…'
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(async () => {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      const r = await fetch(`/api/contacts?${params}`);
      const j = await r.json();
      let list = j.contacts || [];
      if (companyId) {
        list = list.filter(c => c.company?.id === companyId).concat(list.filter(c => c.company?.id !== companyId));
      }
      setResults(list.slice(0, 10));
    }, 180);
    return () => clearTimeout(timer);
  }, [query, open, companyId]);

  function pick(c) {
    onChange({
      id: c.id,
      first_name: c.first_name,
      last_name: c.last_name,
      phone: c.phone,
      email: c.email,
      company: c.company
    });
    setQuery(''); setResults([]); setOpen(false);
  }

  function clear() {
    onChange(null); setQuery(''); setOpen(false);
  }

  const fullName = (c) => [c.first_name, c.last_name].filter(Boolean).join(' ');

  if (value && !creating) {
    return (
      <div style={selectedRow}>
        <User size={14} style={{ color: '#475569' }} />
        <span style={{ flex: 1 }}>{fullName(value)}{value.company?.name ? ` (${value.company.name})` : ''}</span>
        <button type="button" onClick={clear} style={iconBtn}><X size={14} /></button>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        style={input}
      />
      {open && (
        <div style={dropdown}>
          {results.map(c => (
            <div key={c.id} onMouseDown={() => pick(c)} style={dropdownRow}>
              <User size={14} style={{ color: '#475569' }} />
              <span style={{ flex: 1 }}>{fullName(c)}</span>
              {c.company?.name && <span style={companyPill}>{c.company.name}</span>}
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
        <CreateContactInline
          initialName={query}
          companyId={companyId}
          onCreated={(c) => { setCreating(false); pick(c); }}
          onCancel={() => setCreating(false)}
        />
      )}
    </div>
  );
}

function CreateContactInline({ initialName, companyId, onCreated, onCancel }) {
  const parts = (initialName || '').split(/\s+/);
  const [firstName, setFirstName] = useState(parts[0] || '');
  const [lastName, setLastName]   = useState(parts.slice(1).join(' '));
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!firstName.trim()) { setError('First name required'); return; }
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName,
          last_name:  lastName || null,
          company_id: companyId || null,
          phone: phone || null,
          email: email || null,
          primary_market_slug: 'pueblo'
        })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      onCreated(j.contact);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={createCard}>
      <div style={{ fontSize: 12, color: '#475569', marginBottom: 6 }}>New contact</div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" style={input} autoFocus />
        <input value={lastName}  onChange={(e) => setLastName(e.target.value)}  placeholder="Last name"  style={input} />
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" style={input} />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" style={input} />
      </div>
      {error && <div style={{ color: '#b91c1c', fontSize: 12, marginTop: 6 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={btnSecondary}>Cancel</button>
        <button type="button" onClick={submit} disabled={busy || !firstName.trim()} style={btnPrimary}>
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
const companyPill = { fontSize: 11, padding: '2px 6px', background: '#f1f5f9', color: '#475569', borderRadius: 4 };
const createCard = { marginTop: 8, padding: 12, border: '1px solid #cbd5e1', background: '#fff', borderRadius: 6 };
const btnPrimary = { background: '#0f172a', color: '#fff', border: 0, padding: '6px 12px', borderRadius: 5, fontSize: 13, cursor: 'pointer' };
const btnSecondary = { background: '#fff', color: '#475569', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: 5, fontSize: 13, cursor: 'pointer' };
