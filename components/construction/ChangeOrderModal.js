'use client';

// components/construction/ChangeOrderModal.js
// Create or edit a change order. Negative amounts allowed (credit COs).

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { tokens } from './_tokens';

const STATUS_OPTIONS = [
  { value: 'pending',   label: 'Pending' },
  { value: 'approved',  label: 'Approved' },
  { value: 'rejected',  label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function ChangeOrderModal({ projectId, changeOrder, phases = [], subcontracts = [], onClose, onSaved }) {
  const isEdit = !!changeOrder?.id;
  const [coNumber, setCoNumber]     = useState(changeOrder?.co_number || '');
  const [description, setDescription] = useState(changeOrder?.description || '');
  const [amount, setAmount]         = useState(changeOrder?.amount ?? '');
  const [scheduleImpact, setScheduleImpact] = useState(changeOrder?.schedule_impact_days ?? 0);
  const [status, setStatus]         = useState(changeOrder?.status || 'pending');
  const [subId, setSubId]           = useState(changeOrder?.subcontract_id || '');
  const [phaseId, setPhaseId]       = useState(changeOrder?.phase_id || '');
  const [requested, setRequested]   = useState(changeOrder?.requested_date || todayIso());
  const [approved, setApproved]     = useState(changeOrder?.approved_date || '');
  const [notes, setNotes]           = useState(changeOrder?.notes || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (!description.trim()) { setError('Description is required.'); return; }
    if (amount === '' || isNaN(Number(amount))) { setError('Amount is required.'); return; }

    setSubmitting(true);
    const payload = {
      co_number: coNumber.trim() || null,
      description: description.trim(),
      amount: Number(amount),
      schedule_impact_days: scheduleImpact === '' ? 0 : Number(scheduleImpact),
      status,
      subcontract_id: subId || null,
      phase_id: phaseId || null,
      requested_date: requested || null,
      approved_date:  approved || null,
      notes: notes || null,
    };
    try {
      const url = isEdit
        ? `/api/construction/projects/${projectId}/change-orders/${changeOrder.id}`
        : `/api/construction/projects/${projectId}/change-orders`;
      const r = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      onSaved(j.change_order);
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <header style={s.header}>
          <h3 style={s.title}>{isEdit ? 'Edit change order' : 'New change order'}</h3>
          <button onClick={onClose} style={s.closeBtn}><X size={18} /></button>
        </header>

        <form onSubmit={submit} style={s.form}>
          <Row>
            <Field label="CO #" hint="Auto-assigned if blank (CO-001, CO-002, …)">
              <input type="text" value={coNumber} onChange={(e) => setCoNumber(e.target.value)} placeholder="CO-001" style={s.input} />
            </Field>
            <Field label="Status">
              <select value={status} onChange={(e) => setStatus(e.target.value)} style={s.input}>
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          </Row>

          <Field label="Description" required>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={s.textarea} required />
          </Field>

          <Row>
            <Field label="Amount" required hint="Negative for credit COs">
              <input type="number" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" style={s.input} required />
            </Field>
            <Field label="Schedule impact (days)" hint="Negative = saves days">
              <input type="number" step="1" value={scheduleImpact} onChange={(e) => setScheduleImpact(e.target.value)} style={s.input} />
            </Field>
          </Row>

          <Row>
            <Field label="Subcontract">
              <select value={subId} onChange={(e) => setSubId(e.target.value)} style={s.input}>
                <option value="">— project-wide —</option>
                {subcontracts.map(sub => (
                  <option key={sub.id} value={sub.id}>
                    {sub.vendor_name || sub.vendor?.name || '(no vendor)'} — {(sub.scope || '').slice(0, 30)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Phase">
              <select value={phaseId} onChange={(e) => setPhaseId(e.target.value)} style={s.input}>
                <option value="">— none —</option>
                {phases.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
          </Row>

          <Row>
            <Field label="Requested date">
              <input type="date" value={requested} onChange={(e) => setRequested(e.target.value)} style={s.input} />
            </Field>
            <Field label="Approved date" hint={status === 'approved' ? 'Defaults to today if blank' : 'Optional'}>
              <input type="date" value={approved} onChange={(e) => setApproved(e.target.value)} style={s.input} />
            </Field>
          </Row>

          <Field label="Notes">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={s.textarea} />
          </Field>

          {error && <div style={s.error}>{error}</div>}

          <div style={s.actions}>
            <button type="button" onClick={onClose} style={s.cancelBtn} disabled={submitting}>Cancel</button>
            <button type="submit" style={s.submitBtn} disabled={submitting}>
              {submitting && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
              <span>{submitting ? 'Saving…' : (isEdit ? 'Save changes' : 'Add CO')}</span>
            </button>
          </div>
        </form>

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

function Field({ label, hint, required, children }) {
  return (
    <div>
      <div style={s.label}>{label}{required && <span style={{ color: tokens.errorText, marginLeft: 2 }}>*</span>}</div>
      {children}
      {hint && <div style={s.hint}>{hint}</div>}
    </div>
  );
}
function Row({ children }) { return <div style={s.row}>{children}</div>; }
function todayIso() { return new Date().toISOString().slice(0, 10); }

const s = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20, overflowY: 'auto' },
  modal: { background: tokens.surface, borderRadius: 12, width: '100%', maxWidth: 640, boxShadow: '0 20px 40px rgba(0,0,0,0.2)', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: `1px solid ${tokens.surfaceMuted}` },
  title: { margin: 0, fontSize: 16, fontWeight: 600, color: tokens.textPrimary },
  closeBtn: { background: 'transparent', border: 0, cursor: 'pointer', color: tokens.textSecondary, padding: 4, display: 'inline-flex' },
  form: { padding: 20, display: 'flex', flexDirection: 'column', gap: 14 },
  row: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 },
  label: { fontSize: 11, color: tokens.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginBottom: 6 },
  hint: { marginTop: 4, fontSize: 11, color: tokens.textTertiary, fontStyle: 'italic' },
  input: { width: '100%', padding: '8px 10px', border: `1px solid ${tokens.border}`, borderRadius: 6, fontSize: 14, background: tokens.surface, color: tokens.textPrimary, fontFamily: 'inherit' },
  textarea: { width: '100%', padding: '8px 10px', border: `1px solid ${tokens.border}`, borderRadius: 6, fontSize: 14, background: tokens.surface, fontFamily: 'inherit', resize: 'vertical' },
  error: { background: tokens.errorBg, color: tokens.errorText, padding: 10, borderRadius: 6, fontSize: 13 },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 },
  cancelBtn: { background: tokens.surface, color: tokens.textSecondary, border: `1px solid ${tokens.border}`, padding: '8px 16px', borderRadius: 6, fontSize: 14, cursor: 'pointer' },
  submitBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, background: tokens.primary, color: '#fff', border: 0, padding: '8px 16px', borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer' },
};
