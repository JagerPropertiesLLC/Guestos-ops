// app/property-tax/page.js
'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';

const STATUS_STYLES = {
  paid: { bg: '#dcfce7', fg: '#15803d' },
  due_soon: { bg: '#fef3c7', fg: '#a16207' },
  overdue: { bg: '#fee2e2', fg: '#b91c1c' },
  unpaid: { bg: '#f1f5f9', fg: '#475569' }
};

export default function PropertyTaxPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  async function load() {
    setLoading(true);
    const r = await fetch('/api/property-tax');
    const j = await r.json();
    setRecords(j.records || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26 }}>Property Tax</h1>
          <p style={{ marginTop: 4, color: '#64748b' }}>
            Annual property tax records. Reminders fire 60/30/14/7 days before due dates.
          </p>
          <p style={{ marginTop: 6, fontSize: 12, color: '#94a3b8' }}>
            Manual entry for now. Auto-pull from county assessor sites is on the roadmap (Pueblo + Arapahoe County first).
          </p>
        </div>
        <button onClick={() => setShowNew(true)} style={btnPrimary}><Plus size={14} /> Add tax record</button>
      </div>

      {loading && <p style={{ marginTop: 24 }}>Loading…</p>}

      {!loading && records.length === 0 && (
        <Empty title="No property tax records yet"
          hint="Add records as your assessment letters come in (typically April-May). The system will remind you before each due date." />
      )}

      {!loading && records.length > 0 && (
        <div style={{ marginTop: 24, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Property', 'Year', 'Assessed', 'Tax', 'Due', 'Status', 'Authority'].map(h => (
              <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #e2e8f0', fontWeight: 600 }}>{h}</th>
            ))}</tr></thead>
            <tbody>
              {records.map(r => {
                const s = STATUS_STYLES[r.status];
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={td}><strong>{r.property?.short_name}</strong></td>
                    <td style={td}>{r.tax_year}</td>
                    <td style={td}>{r.assessed_value ? `$${Number(r.assessed_value).toLocaleString()}` : '—'}</td>
                    <td style={td}>{r.total_tax ? `$${Number(r.total_tax).toLocaleString()}` : '—'}</td>
                    <td style={td}>{r.due_date || '—'}</td>
                    <td style={td}><span style={{ background: s.bg, color: s.fg, padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500 }}>{r.status.replace('_', ' ')}</span></td>
                    <td style={td}>{r.authority || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showNew && <NewTaxRecordModal onClose={() => { setShowNew(false); load(); }} />}
    </div>
  );
}

function NewTaxRecordModal({ onClose }) {
  const [props, setProps] = useState([]);
  const [form, setForm] = useState({
    property_id: '', tax_year: new Date().getFullYear(),
    assessed_value: '', taxable_value: '', total_tax: '',
    due_date: '', authority: '', parcel_number: '', notes: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/sidebar-nav').then(r => r.json()).then(d => setProps(d.properties || []));
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const valid = form.property_id && form.tax_year && form.total_tax && form.due_date && form.authority;

  async function submit() {
    setSubmitting(true);
    const r = await fetch('/api/property-tax', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...form,
        tax_year: parseInt(form.tax_year, 10),
        assessed_value: form.assessed_value ? parseFloat(form.assessed_value) : null,
        taxable_value: form.taxable_value ? parseFloat(form.taxable_value) : null,
        total_tax: parseFloat(form.total_tax)
      })
    });
    setSubmitting(false);
    if (r.ok) onClose();
    else alert(await r.text());
  }

  return (
    <Modal onClose={onClose} title="New property tax record">
      <Field label="Property *" required>
        <select value={form.property_id} onChange={set('property_id')} style={inputStyle} required>
          <option value="">— Select —</option>
          {props.map(p => <option key={p.id} value={p.id}>{p.short_name}</option>)}
        </select>
      </Field>
      <Field label="Tax year *" required>
        <input type="number" value={form.tax_year} onChange={set('tax_year')} style={inputStyle} required />
      </Field>
      <Field label="Authority *" required>
        <input value={form.authority} onChange={set('authority')} style={inputStyle} placeholder="Pueblo County Treasurer" required />
      </Field>
      <Field label="Parcel number">
        <input value={form.parcel_number} onChange={set('parcel_number')} style={inputStyle} />
      </Field>
      <Field label="Assessed value">
        <input type="number" value={form.assessed_value} onChange={set('assessed_value')} style={inputStyle} />
      </Field>
      <Field label="Taxable value">
        <input type="number" value={form.taxable_value} onChange={set('taxable_value')} style={inputStyle} />
      </Field>
      <Field label="Total tax *" required>
        <input type="number" step="0.01" value={form.total_tax} onChange={set('total_tax')} style={inputStyle} required />
      </Field>
      <Field label="Due date *" required>
        <input type="date" value={form.due_date} onChange={set('due_date')} style={inputStyle} required />
      </Field>
      <Field label="Notes"><textarea value={form.notes} onChange={set('notes')} style={{ ...inputStyle, minHeight: 60 }} /></Field>
      <ModalFooter onCancel={onClose} onSubmit={submit} canSubmit={valid && !submitting} submitLabel={submitting ? 'Saving…' : 'Create'} />
    </Modal>
  );
}

function Empty({ title, hint }) {
  return (
    <div style={{ marginTop: 24, padding: 40, textAlign: 'center', background: '#fff', border: '1px dashed #cbd5e1', borderRadius: 10 }}>
      <div style={{ fontSize: 16, fontWeight: 500 }}>{title}</div>
      <div style={{ fontSize: 13, color: '#64748b', marginTop: 6, maxWidth: 500, marginLeft: 'auto', marginRight: 'auto' }}>{hint}</div>
    </div>
  );
}

const td = { padding: '12px', fontSize: 14 };
const inputStyle = { width: '100%', padding: '8px 10px', border: '1px solid #d4d4d4', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' };
const btnPrimary = { background: '#0f172a', color: '#fff', border: 0, padding: '10px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 };
const btnSecondary = { background: '#fff', color: '#0f172a', border: '1px solid #d4d4d4', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 14 };

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
