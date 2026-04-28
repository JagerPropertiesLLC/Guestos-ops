// app/maintenance/page.js
'use client';

import { useEffect, useState } from 'react';
import { Wrench, AlertTriangle } from 'lucide-react';

const STATUS_COLUMNS = [
  { key: 'submitted', label: 'New', color: '#dbeafe', fg: '#1e40af' },
  { key: 'acknowledged', label: 'Acknowledged', color: '#e0e7ff', fg: '#3730a3' },
  { key: 'assigned', label: 'Assigned', color: '#fef3c7', fg: '#92400e' },
  { key: 'in_progress', label: 'In progress', color: '#fde68a', fg: '#78350f' },
  { key: 'completed', label: 'Completed', color: '#dcfce7', fg: '#166534' }
];

export default function MaintenancePage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState('all');
  const [showNew, setShowNew] = useState(false);

  async function load() {
    setLoading(true);
    const url = moduleFilter === 'all' ? '/api/maintenance' : `/api/maintenance?module=${moduleFilter}`;
    const r = await fetch(url);
    const j = await r.json();
    setRequests(j.requests || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [moduleFilter]);

  const grouped = STATUS_COLUMNS.reduce((acc, col) => {
    acc[col.key] = requests.filter(r => r.status === col.key);
    return acc;
  }, {});

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26 }}>Maintenance</h1>
          <p style={{ marginTop: 4, color: '#64748b' }}>
            All work orders across the portfolio. Filter by module to focus.
          </p>
        </div>
        <button onClick={() => setShowNew(true)} style={btnPrimary}>+ New request</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        {['all', 'str', 'ltr', 'construction'].map(m => (
          <FilterChip key={m} active={moduleFilter === m} onClick={() => setModuleFilter(m)}>
            {m === 'all' ? 'All' : m.toUpperCase()}
          </FilterChip>
        ))}
      </div>

      {loading && <p>Loading…</p>}

      {!loading && requests.length === 0 && (
        <Empty title="No maintenance requests yet"
          hint="Tenants will submit requests through the tenant portal. You can also create requests directly here." />
      )}

      {!loading && requests.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {STATUS_COLUMNS.map(col => (
            <div key={col.key}>
              <div style={{
                padding: '8px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                color: col.fg, background: col.color, marginBottom: 8,
                display: 'flex', justifyContent: 'space-between'
              }}>
                <span>{col.label}</span>
                <span>{grouped[col.key].length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {grouped[col.key].map(r => <RequestCard key={r.id} request={r} onUpdate={load} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew && <NewMaintenanceModal onClose={() => { setShowNew(false); load(); }} />}
    </div>
  );
}

function RequestCard({ request, onUpdate }) {
  const priorityColors = {
    emergency: '#fee2e2',
    high: '#fef3c7',
    normal: '#fff',
    low: '#f8fafc'
  };
  return (
    <div style={{
      background: priorityColors[request.priority] || '#fff',
      border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, fontSize: 13
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{request.title}</div>
      <div style={{ color: '#64748b', fontSize: 12 }}>
        {request.property?.short_name || '—'} · {request.category} · {request.module.toUpperCase()}
      </div>
      {request.priority === 'emergency' && (
        <div style={{ marginTop: 4, color: '#b91c1c', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
          <AlertTriangle size={12} /> Emergency
        </div>
      )}
      {request.assigned_to_company && (
        <div style={{ marginTop: 6, fontSize: 11, color: '#475569' }}>
          → {request.assigned_to_company.name}
        </div>
      )}
    </div>
  );
}

function NewMaintenanceModal({ onClose }) {
  const [props, setProps] = useState([]);
  const [form, setForm] = useState({
    property_id: '', title: '', description: '',
    category: 'other', priority: 'normal', module: 'ltr'
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/sidebar-nav').then(r => r.json()).then(d => setProps(d.properties || []));
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const valid = form.property_id && form.title && form.description && form.category && form.priority && form.module;

  async function submit() {
    if (!valid) return;
    setSubmitting(true);
    const r = await fetch('/api/maintenance', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form)
    });
    setSubmitting(false);
    if (r.ok) onClose();
    else alert(await r.text());
  }

  return (
    <Modal onClose={onClose} title="New maintenance request">
      <Field label="Property *" required>
        <select value={form.property_id} onChange={set('property_id')} style={inputStyle} required>
          <option value="">— Select —</option>
          {props.map(p => <option key={p.id} value={p.id}>{p.short_name}</option>)}
        </select>
      </Field>
      <Field label="Module *" required>
        <select value={form.module} onChange={set('module')} style={inputStyle} required>
          <option value="ltr">Long Term</option>
          <option value="str">Short Term</option>
          <option value="construction">Construction</option>
        </select>
      </Field>
      <Field label="Title *" required>
        <input value={form.title} onChange={set('title')} style={inputStyle} placeholder="Disposal not working" required />
      </Field>
      <Field label="Description *" required>
        <textarea value={form.description} onChange={set('description')} style={{ ...inputStyle, minHeight: 80 }} required />
      </Field>
      <Field label="Category *" required>
        <select value={form.category} onChange={set('category')} style={inputStyle} required>
          {['plumbing','electrical','hvac','appliance','pest','lock','painting','exterior','landscaping','other'].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Priority *" required>
        <select value={form.priority} onChange={set('priority')} style={inputStyle} required>
          <option value="emergency">Emergency</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>
      </Field>
      <ModalFooter onCancel={onClose} onSubmit={submit} canSubmit={valid && !submitting} submitLabel={submitting ? 'Saving…' : 'Create'} />
    </Modal>
  );
}

function Empty({ title, hint }) {
  return (
    <div style={{ padding: 40, textAlign: 'center', background: '#fff', border: '1px dashed #cbd5e1', borderRadius: 10 }}>
      <div style={{ fontSize: 16, fontWeight: 500 }}>{title}</div>
      <div style={{ fontSize: 13, color: '#64748b', marginTop: 6, maxWidth: 500, marginLeft: 'auto', marginRight: 'auto' }}>{hint}</div>
    </div>
  );
}

function FilterChip({ children, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: active ? '#0f172a' : '#fff', color: active ? '#fff' : '#475569',
      border: '1px solid ' + (active ? '#0f172a' : '#e2e8f0'),
      padding: '6px 12px', borderRadius: 999, fontSize: 13, cursor: 'pointer'
    }}>{children}</button>
  );
}

const inputStyle = { width: '100%', padding: '8px 10px', border: '1px solid #d4d4d4', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' };
const btnPrimary = { background: '#0f172a', color: '#fff', border: 0, padding: '10px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 14 };
const btnSecondary = { background: '#fff', color: '#0f172a', border: '1px solid #d4d4d4', padding: '8px 16px', borderRadius: 6, cursor: 'pointer' };

function Field({ label, children, required }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#444', marginBottom: 4 }}>
        {label}{required && <span style={{ color: '#dc2626' }}> *</span>}
      </label>
      {children}
    </div>
  );
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
function ModalFooter({ onCancel, onSubmit, canSubmit, submitLabel = 'Save' }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
      <button onClick={onCancel} style={btnSecondary}>Cancel</button>
      <button onClick={onSubmit} disabled={!canSubmit} style={{ ...btnPrimary, opacity: canSubmit ? 1 : 0.5 }}>{submitLabel}</button>
    </div>
  );
}
