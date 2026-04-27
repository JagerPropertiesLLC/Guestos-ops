// app/contacts/page.js
'use client';

import { useEffect, useState } from 'react';

export default function ContactsPage() {
  const [tab, setTab] = useState('contacts');
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <h1 style={{ margin: 0, fontSize: 28 }}>Rolodex</h1>
      <p style={{ marginTop: 4, color: '#666' }}>Subs, inspectors, engineers, vendors, and the companies they work for.</p>

      <div style={{ borderBottom: '1px solid #e5e5e5', margin: '20px 0', display: 'flex', gap: 4 }}>
        <Tab active={tab==='contacts'} onClick={() => setTab('contacts')}>Contacts</Tab>
        <Tab active={tab==='companies'} onClick={() => setTab('companies')}>Companies</Tab>
      </div>

      {tab === 'contacts' ? <ContactsList /> : <CompaniesList />}
    </div>
  );
}

function Tab({ children, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: 'transparent', border: 0, padding: '10px 14px', cursor: 'pointer',
      borderBottom: active ? '2px solid #111' : '2px solid transparent',
      fontWeight: active ? 600 : 400, color: active ? '#111' : '#666'
    }}>{children}</button>
  );
}

function ContactsList() {
  const [contacts, setContacts] = useState([]);
  const [market, setMarket] = useState('all');
  const [showNew, setShowNew] = useState(false);

  async function load() {
    const r = await fetch(`/api/contacts?market=${market}`);
    const j = await r.json();
    setContacts(j.contacts || []);
  }
  useEffect(() => { load(); }, [market]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <select value={market} onChange={(e) => setMarket(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d4d4d4' }}>
          <option value="all">All markets</option>
          <option value="pueblo">Pueblo</option>
          <option value="aurora">Aurora</option>
        </select>
        <button onClick={() => setShowNew(true)} style={btnPrimary}>+ New contact</button>
      </div>
      <table style={tableStyle}>
        <thead><tr>{['Name', 'Trade', 'Company', 'Market', 'Phone', 'Email'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>
          {contacts.map((c) => (
            <tr key={c.id}>
              <td style={td}>{c.first_name} {c.last_name}</td>
              <td style={td}>{c.trade || '—'}</td>
              <td style={td}>{c.company?.name || '—'}</td>
              <td style={td}>{c.multi_market ? 'Multi' : (c.market?.name || '—')}</td>
              <td style={td}>{c.phone || '—'}</td>
              <td style={td}>{c.email || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {contacts.length === 0 && <p style={{ textAlign: 'center', color: '#666', padding: 24 }}>No contacts yet.</p>}
      {showNew && <NewContactModal onClose={() => { setShowNew(false); load(); }} />}
    </div>
  );
}

function NewContactModal({ onClose }) {
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState({
    first_name: '', last_name: '', company_id: '', primary_market_slug: 'pueblo',
    multi_market: false, trade: '', phone: '', email: '', notes: ''
  });
  useEffect(() => {
    fetch('/api/companies').then(r => r.json()).then(j => setCompanies(j.companies || []));
  }, []);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  async function submit() {
    const r = await fetch('/api/contacts', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form)
    });
    if (r.ok) onClose(); else alert(await r.text());
  }
  return (
    <Modal onClose={onClose} title="New contact">
      <Field label="First name"><input value={form.first_name} onChange={set('first_name')} style={inputStyle} /></Field>
      <Field label="Last name"><input value={form.last_name} onChange={set('last_name')} style={inputStyle} /></Field>
      <Field label="Trade">
        <select value={form.trade} onChange={set('trade')} style={inputStyle}>
          <option value="">— Select —</option>
          {['plumber','electrician','hvac','concrete','framing','roofing','sitework','grading','landscaping','flooring','painting','drywall','inspector','engineer','architect','realtor','cleaner','handyman','other'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="Company">
        <select value={form.company_id} onChange={set('company_id')} style={inputStyle}>
          <option value="">— None / freelancer —</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="Primary market">
        <select value={form.primary_market_slug} onChange={set('primary_market_slug')} style={inputStyle}>
          <option value="pueblo">Pueblo</option>
          <option value="aurora">Aurora</option>
        </select>
      </Field>
      <Field label="">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
          <input type="checkbox" checked={form.multi_market} onChange={set('multi_market')} />
          Works in both Pueblo and Aurora
        </label>
      </Field>
      <Field label="Phone"><input value={form.phone} onChange={set('phone')} style={inputStyle} /></Field>
      <Field label="Email"><input value={form.email} onChange={set('email')} style={inputStyle} /></Field>
      <Field label="Notes"><textarea value={form.notes} onChange={set('notes')} style={{ ...inputStyle, minHeight: 60 }} /></Field>
      <ModalFooter onCancel={onClose} onSubmit={submit} canSubmit={!!form.first_name} />
    </Modal>
  );
}

function CompaniesList() {
  const [companies, setCompanies] = useState([]);
  const [market, setMarket] = useState('all');
  const [showNew, setShowNew] = useState(false);

  async function load() {
    const r = await fetch(`/api/companies?market=${market}`);
    const j = await r.json();
    setCompanies(j.companies || []);
  }
  useEffect(() => { load(); }, [market]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <select value={market} onChange={(e) => setMarket(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d4d4d4' }}>
          <option value="all">All markets</option>
          <option value="pueblo">Pueblo</option>
          <option value="aurora">Aurora</option>
        </select>
        <button onClick={() => setShowNew(true)} style={btnPrimary}>+ New company</button>
      </div>
      <table style={tableStyle}>
        <thead><tr>{['Name', 'Type', 'Market', 'Phone', 'W9', 'COI', 'Expires'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>
          {companies.map((c) => (
            <tr key={c.id}>
              <td style={td}>{c.name}</td>
              <td style={td}>{c.type || '—'}</td>
              <td style={td}>{c.multi_market ? 'Multi' : (c.market?.name || '—')}</td>
              <td style={td}>{c.phone || '—'}</td>
              <td style={td}>{c.w9_on_file ? '✓' : '—'}</td>
              <td style={td}>{c.coi_on_file ? '✓' : '—'}</td>
              <td style={td}>{c.coi_expires || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {companies.length === 0 && <p style={{ textAlign: 'center', color: '#666', padding: 24 }}>No companies yet.</p>}
      {showNew && <NewCompanyModal onClose={() => { setShowNew(false); load(); }} />}
    </div>
  );
}

function NewCompanyModal({ onClose }) {
  const [form, setForm] = useState({
    name: '', type: 'sub', primary_market_slug: 'pueblo', multi_market: false,
    phone: '', email: '', website: '', address: '', ein: '',
    w9_on_file: false, coi_on_file: false, coi_expires: '', notes: ''
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  async function submit() {
    const r = await fetch('/api/companies', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form)
    });
    if (r.ok) onClose(); else alert(await r.text());
  }
  return (
    <Modal onClose={onClose} title="New company">
      <Field label="Name"><input value={form.name} onChange={set('name')} style={inputStyle} /></Field>
      <Field label="Type">
        <select value={form.type} onChange={set('type')} style={inputStyle}>
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
      </Field>
      <Field label="Primary market">
        <select value={form.primary_market_slug} onChange={set('primary_market_slug')} style={inputStyle}>
          <option value="pueblo">Pueblo</option>
          <option value="aurora">Aurora</option>
        </select>
      </Field>
      <Field label="">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
          <input type="checkbox" checked={form.multi_market} onChange={set('multi_market')} />
          Works in both markets
        </label>
      </Field>
      <Field label="Phone"><input value={form.phone} onChange={set('phone')} style={inputStyle} /></Field>
      <Field label="Email"><input value={form.email} onChange={set('email')} style={inputStyle} /></Field>
      <Field label="EIN"><input value={form.ein} onChange={set('ein')} style={inputStyle} /></Field>
      <Field label="">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 4 }}>
          <input type="checkbox" checked={form.w9_on_file} onChange={set('w9_on_file')} /> W9 on file
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
          <input type="checkbox" checked={form.coi_on_file} onChange={set('coi_on_file')} /> COI on file
        </label>
      </Field>
      <Field label="COI expires"><input type="date" value={form.coi_expires} onChange={set('coi_expires')} style={inputStyle} /></Field>
      <Field label="Notes"><textarea value={form.notes} onChange={set('notes')} style={{ ...inputStyle, minHeight: 60 }} /></Field>
      <ModalFooter onCancel={onClose} onSubmit={submit} canSubmit={!!form.name} />
    </Modal>
  );
}

// shared
const inputStyle = { width: '100%', padding: '8px 10px', border: '1px solid #d4d4d4', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' };
const btnPrimary = { background: '#111', color: '#fff', border: 0, padding: '8px 16px', borderRadius: 6, cursor: 'pointer' };
const btnSecondary = { background: '#fff', color: '#111', border: '1px solid #d4d4d4', padding: '8px 16px', borderRadius: 6, cursor: 'pointer' };
const tableStyle = { width: '100%', borderCollapse: 'collapse', background: '#fff', border: '1px solid #e5e5e5', borderRadius: 8, overflow: 'hidden' };
const th = { padding: '10px 12px', textAlign: 'left', fontSize: 12, color: '#666', textTransform: 'uppercase', letterSpacing: 0.4, borderBottom: '1px solid #e5e5e5' };
const td = { padding: '10px 12px', borderBottom: '1px solid #f0f0f0', fontSize: 14 };

function Field({ label, children }) {
  return <div style={{ marginBottom: 12 }}><label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#444', marginBottom: 4 }}>{label}</label>{children}</div>;
}
function Modal({ children, onClose, title }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 8, padding: 24, width: 500, maxHeight: '90vh', overflow: 'auto' }}>
        <h2 style={{ marginTop: 0 }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}
function ModalFooter({ onCancel, onSubmit, canSubmit }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
      <button onClick={onCancel} style={btnSecondary}>Cancel</button>
      <button onClick={onSubmit} disabled={!canSubmit} style={btnPrimary}>Save</button>
    </div>
  );
}
