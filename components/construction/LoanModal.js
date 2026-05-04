'use client';

// components/construction/LoanModal.js
// Create or edit a project loan. Lender uses VendorPicker with
// companyType='lender'. Note: real-world lenders are sometimes individuals
// (e.g. family members lending personally) — for MVP they get a row in
// `companies` with type='lender' even though the wording is slightly off.

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { tokens } from './_tokens';
import VendorPicker from './VendorPicker';

const STATUS_OPTIONS = [
  { value: 'active',      label: 'Active' },
  { value: 'paid_off',    label: 'Paid off' },
  { value: 'refinanced',  label: 'Refinanced' },
  { value: 'defaulted',   label: 'Defaulted' },
  { value: 'closed',      label: 'Closed' },
];

export default function LoanModal({ projectId, loan, onClose, onSaved }) {
  const isEdit = !!loan?.id;
  const [lender, setLender]                 = useState(
    loan?.lender || (loan?.lender_company_id ? { id: loan.lender_company_id, name: loan.lender_display_name || loan.lender_name || '' } : null)
  );
  const [loanNumber, setLoanNumber]         = useState(loan?.loan_number || '');
  const [totalAmount, setTotalAmount]       = useState(loan?.total_loan_amount ?? '');
  const [interestRate, setInterestRate]     = useState(loan?.interest_rate ?? '');
  const [origDate, setOrigDate]             = useState(loan?.origination_date || '');
  const [maturity, setMaturity]             = useState(loan?.maturity_date || '');
  const [status, setStatus]                 = useState(loan?.status || 'active');
  const [notes, setNotes]                   = useState(loan?.notes || '');
  const [submitting, setSubmitting]         = useState(false);
  const [error, setError]                   = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (totalAmount === '' || isNaN(Number(totalAmount))) { setError('Total loan amount is required.'); return; }
    if (Number(totalAmount) <= 0) { setError('Total loan amount must be greater than zero.'); return; }

    setSubmitting(true);
    const payload = {
      lender_company_id: lender?.id || null,
      lender_name: lender?.name || null,
      loan_number: loanNumber || null,
      total_loan_amount: Number(totalAmount),
      interest_rate: interestRate === '' ? null : Number(interestRate),
      origination_date: origDate || null,
      maturity_date: maturity || null,
      status,
      notes: notes || null,
    };
    try {
      const url = isEdit
        ? `/api/construction/projects/${projectId}/loans/${loan.id}`
        : `/api/construction/projects/${projectId}/loans`;
      const r = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      onSaved(j.loan);
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <header style={s.header}>
          <h3 style={s.title}>{isEdit ? 'Edit loan' : 'New loan'}</h3>
          <button onClick={onClose} style={s.closeBtn}><X size={18} /></button>
        </header>

        <form onSubmit={submit} style={s.form}>
          <Field label="Lender" hint="Bank or individual. Start typing to pick or create.">
            <VendorPicker
              value={lender}
              onChange={setLender}
              placeholder="Lender (start typing…)"
              companyType="lender"
            />
          </Field>

          <Row>
            <Field label="Loan number">
              <input type="text" value={loanNumber} onChange={(e) => setLoanNumber(e.target.value)} style={s.input} />
            </Field>
            <Field label="Status">
              <select value={status} onChange={(e) => setStatus(e.target.value)} style={s.input}>
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          </Row>

          <Row>
            <Field label="Total loan amount" required>
              <input type="number" step="any" min="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} placeholder="0.00" style={s.input} required />
            </Field>
            <Field label="Interest rate %" hint="0–100">
              <input type="number" step="any" min="0" max="100" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} style={s.input} />
            </Field>
          </Row>

          <Row>
            <Field label="Origination date">
              <input type="date" value={origDate} onChange={(e) => setOrigDate(e.target.value)} style={s.input} />
            </Field>
            <Field label="Maturity date">
              <input type="date" value={maturity} onChange={(e) => setMaturity(e.target.value)} style={s.input} />
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
              <span>{submitting ? 'Saving…' : (isEdit ? 'Save changes' : 'Add loan')}</span>
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
