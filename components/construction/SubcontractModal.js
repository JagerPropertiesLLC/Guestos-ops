'use client';

// components/construction/SubcontractModal.js
// Create or edit a subcontract header. Vendor uses VendorPicker with
// companyType='subcontractor' so create-on-the-fly tags the new company
// correctly (vs the 'vendor' default used by ExpenseModal).

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { tokens } from './_tokens';
import VendorPicker from './VendorPicker';

const STATUS_OPTIONS = [
  { value: 'draft',       label: 'Draft' },
  { value: 'signed',      label: 'Signed' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'complete',    label: 'Complete' },
  { value: 'terminated',  label: 'Terminated' },
];

export default function SubcontractModal({ projectId, subcontract, onClose, onSaved }) {
  const isEdit = !!subcontract?.id;
  const [vendor, setVendor]                 = useState(
    subcontract?.vendor || (subcontract?.company_id ? { id: subcontract.company_id, name: subcontract.vendor_name || '' } : null)
  );
  const [scope, setScope]                   = useState(subcontract?.scope || '');
  const [contractValue, setContractValue]   = useState(subcontract?.contract_value ?? '');
  const [retainagePct, setRetainagePct]     = useState(subcontract?.retainage_pct ?? 10);
  const [status, setStatus]                 = useState(subcontract?.status || 'draft');
  const [signedDate, setSignedDate]         = useState(subcontract?.contract_signed_date || '');
  const [notes, setNotes]                   = useState(subcontract?.notes || '');
  const [submitting, setSubmitting]         = useState(false);
  const [error, setError]                   = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (!scope.trim()) { setError('Scope description is required.'); return; }
    if (contractValue === '' || isNaN(Number(contractValue))) { setError('Contract amount is required.'); return; }

    setSubmitting(true);
    const payload = {
      company_id: vendor?.id || null,
      scope: scope.trim(),
      contract_value: Number(contractValue),
      retainage_pct: retainagePct === '' ? null : Number(retainagePct),
      status,
      contract_signed_date: signedDate || null,
      notes: notes || null,
    };
    try {
      const url = isEdit
        ? `/api/construction/projects/${projectId}/subcontracts/${subcontract.id}`
        : `/api/construction/projects/${projectId}/subcontracts`;
      const r = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      onSaved(j.subcontract);
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <header style={s.header}>
          <h3 style={s.title}>{isEdit ? 'Edit subcontract' : 'New subcontract'}</h3>
          <button onClick={onClose} style={s.closeBtn}><X size={18} /></button>
        </header>

        <form onSubmit={submit} style={s.form}>
          <Field label="Vendor" hint="Subcontractor company. Start typing to pick or create.">
            <VendorPicker
              value={vendor}
              onChange={setVendor}
              placeholder="Subcontractor (start typing…)"
              companyType="subcontractor"
            />
          </Field>

          <Field label="Scope" required hint="What this subcontractor is doing on the project.">
            <textarea
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              rows={2}
              placeholder="e.g. Sitework, foundation, framing, roofing…"
              style={s.textarea}
              required
            />
          </Field>

          <Row>
            <Field label="Contract amount" required>
              <input
                type="number" step="any" min="0"
                value={contractValue}
                onChange={(e) => setContractValue(e.target.value)}
                placeholder="0.00"
                style={s.input}
                required
              />
            </Field>
            <Field label="Retainage %" hint="Default for line items; can be overridden per row.">
              <input
                type="number" step="any" min="0" max="100"
                value={retainagePct}
                onChange={(e) => setRetainagePct(e.target.value)}
                style={s.input}
              />
            </Field>
          </Row>

          <Row>
            <Field label="Status">
              <select value={status} onChange={(e) => setStatus(e.target.value)} style={s.input}>
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Contract signed date">
              <input type="date" value={signedDate} onChange={(e) => setSignedDate(e.target.value)} style={s.input} />
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
              <span>{submitting ? 'Saving…' : (isEdit ? 'Save changes' : 'Add subcontract')}</span>
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
      <div style={s.label}>
        {label}{required && <span style={{ color: tokens.errorText, marginLeft: 2 }}>*</span>}
      </div>
      {children}
      {hint && <div style={s.hint}>{hint}</div>}
    </div>
  );
}

function Row({ children }) { return <div style={s.row}>{children}</div>; }

const s = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 50, padding: 20, overflowY: 'auto',
  },
  modal: {
    background: tokens.surface, borderRadius: 12, width: '100%', maxWidth: 640,
    boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
    maxHeight: 'calc(100vh - 40px)', overflowY: 'auto',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 20px', borderBottom: `1px solid ${tokens.surfaceMuted}`,
  },
  title: { margin: 0, fontSize: 16, fontWeight: 600, color: tokens.textPrimary },
  closeBtn: { background: 'transparent', border: 0, cursor: 'pointer', color: tokens.textSecondary, padding: 4, display: 'inline-flex' },
  form: { padding: 20, display: 'flex', flexDirection: 'column', gap: 14 },
  row: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 },
  label: { fontSize: 11, color: tokens.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginBottom: 6 },
  hint: { marginTop: 4, fontSize: 11, color: tokens.textTertiary, fontStyle: 'italic' },
  input: {
    width: '100%', padding: '8px 10px', border: `1px solid ${tokens.border}`,
    borderRadius: 6, fontSize: 14, background: tokens.surface, color: tokens.textPrimary,
    fontFamily: 'inherit',
  },
  textarea: {
    width: '100%', padding: '8px 10px', border: `1px solid ${tokens.border}`,
    borderRadius: 6, fontSize: 14, background: tokens.surface, fontFamily: 'inherit', resize: 'vertical',
  },
  error: { background: tokens.errorBg, color: tokens.errorText, padding: 10, borderRadius: 6, fontSize: 13 },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 },
  cancelBtn: {
    background: tokens.surface, color: tokens.textSecondary, border: `1px solid ${tokens.border}`,
    padding: '8px 16px', borderRadius: 6, fontSize: 14, cursor: 'pointer',
  },
  submitBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: tokens.primary, color: '#fff', border: 0,
    padding: '8px 16px', borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer',
  },
};
