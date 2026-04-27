// app/construction/page.js
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function ConstructionPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  async function load() {
    setLoading(true);
    const r = await fetch('/api/projects');
    const j = await r.json();
    setProjects(j.projects || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28 }}>Construction</h1>
          <p style={{ margin: '4px 0 0', color: '#666' }}>Active and completed construction projects.</p>
        </div>
        <button onClick={() => setShowNew(true)}
          style={{ background: '#111', color: '#fff', border: 0, padding: '10px 16px', borderRadius: 6, cursor: 'pointer' }}>
          + New project
        </button>
      </div>

      {loading && <p>Loading…</p>}
      {!loading && projects.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', background: '#f7f7f7', borderRadius: 8 }}>
          <p style={{ color: '#666', margin: 0 }}>No projects yet.</p>
        </div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {projects.map((p) => (
          <Link key={p.id} href={`/construction/${p.id}`}
            style={{ display: 'block', padding: 16, border: '1px solid #e5e5e5', borderRadius: 8,
                     textDecoration: 'none', color: 'inherit', background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 4 }}>{p.name}</div>
                <div style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>{p.address}</div>
                <div style={{ fontSize: 12, color: '#888' }}>
                  {p.entity?.name} · {p.market?.name}
                </div>
              </div>
              <StatusPill status={p.status} />
            </div>
          </Link>
        ))}
      </div>

      {showNew && <NewProjectModal onClose={() => { setShowNew(false); load(); }} />}
    </div>
  );
}

function StatusPill({ status }) {
  const colors = {
    planning: ['#eef2ff', '#3730a3'],
    active: ['#ecfdf5', '#065f46'],
    on_hold: ['#fef3c7', '#92400e'],
    complete: ['#f3f4f6', '#374151'],
    cancelled: ['#fef2f2', '#991b1b']
  };
  const [bg, fg] = colors[status] || ['#f3f4f6', '#374151'];
  return (
    <span style={{ background: bg, color: fg, padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 500 }}>
      {status}
    </span>
  );
}

function NewProjectModal({ onClose }) {
  const [entities, setEntities] = useState([]);
  const [markets, setMarkets] = useState([]);
  const [form, setForm] = useState({
    name: '', entity_id: '', market_id: '', type: 'new_construction',
    address: '', total_budget: '', target_completion: '', notes: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      // We'll need a small endpoint for entities/markets — using raw fetch via Supabase later if needed.
      // For now, fetch from a simple meta endpoint.
      const r = await fetch('/api/projects/meta').catch(() => null);
      if (r && r.ok) {
        const j = await r.json();
        setEntities(j.entities || []);
        setMarkets(j.markets || []);
      }
    })();
  }, []);

  async function submit() {
    setSubmitting(true);
    const r = await fetch('/api/projects', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...form,
        total_budget: form.total_budget ? Number(form.total_budget) : null
      })
    });
    setSubmitting(false);
    if (r.ok) onClose();
    else alert('Error: ' + (await r.text()));
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>New project</h2>
        <Field label="Name"><input value={form.name} onChange={set('name')} style={inputStyle} /></Field>
        <Field label="Entity (LLC)">
          <select value={form.entity_id} onChange={set('entity_id')} style={inputStyle}>
            <option value="">Select…</option>
            {entities.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </Field>
        <Field label="Market">
          <select value={form.market_id} onChange={set('market_id')} style={inputStyle}>
            <option value="">Select…</option>
            {markets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="Type">
          <select value={form.type} onChange={set('type')} style={inputStyle}>
            <option value="new_construction">New construction</option>
            <option value="renovation">Renovation</option>
            <option value="tenant_improvement">Tenant improvement</option>
          </select>
        </Field>
        <Field label="Address"><input value={form.address} onChange={set('address')} style={inputStyle} /></Field>
        <Field label="Total budget ($)"><input type="number" value={form.total_budget} onChange={set('total_budget')} style={inputStyle} /></Field>
        <Field label="Target completion"><input type="date" value={form.target_completion} onChange={set('target_completion')} style={inputStyle} /></Field>
        <Field label="Notes"><textarea value={form.notes} onChange={set('notes')} style={{ ...inputStyle, minHeight: 80 }} /></Field>
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btnSecondary}>Cancel</button>
          <button onClick={submit} disabled={submitting || !form.name || !form.entity_id || !form.market_id} style={btnPrimary}>
            {submitting ? 'Saving…' : 'Create project'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#444', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle = { width: '100%', padding: '8px 10px', border: '1px solid #d4d4d4', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' };
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 };
const modalStyle = { background: '#fff', borderRadius: 8, padding: 24, width: 500, maxHeight: '90vh', overflow: 'auto' };
const btnPrimary = { background: '#111', color: '#fff', border: 0, padding: '8px 16px', borderRadius: 6, cursor: 'pointer' };
const btnSecondary = { background: '#fff', color: '#111', border: '1px solid #d4d4d4', padding: '8px 16px', borderRadius: 6, cursor: 'pointer' };
