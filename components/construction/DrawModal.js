'use client';

// components/construction/DrawModal.js
// Create or edit a draw. Supports preset scoping when opened from the
// subcontract or loan detail page (locks subcontract_id / project_loan_id +
// the draw_type).

import { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { tokens } from './_tokens';

const STATUS_OPTIONS = [
  { value: 'pending',   label: 'Pending' },
  { value: 'approved',  label: 'Approved' },
  { value: 'paid',      label: 'Paid' },
  { value: 'rejected',  label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

const TYPE_OPTIONS = [
  { value: 'subcontractor', label: 'Subcontractor' },
  { value: 'loan',          label: 'Loan draw' },
  { value: 'owner',         label: 'Owner contribution' },
  { value: 'other',         label: 'Other' },
];

const LIEN_WAIVER_TYPES = [
  { value: '',                         label: '— select type —' },
  { value: 'conditional_progress',     label: 'Conditional progress' },
  { value: 'unconditional_progress',   label: 'Unconditional progress' },
  { value: 'conditional_final',        label: 'Conditional final' },
  { value: 'unconditional_final',      label: 'Unconditional final' },
];

export default function DrawModal({
  projectId, draw, subcontracts = [], loans = [],
  presetSubcontractId, presetLoanId, presetDrawType,
  scopeLocked = false,
  onClose, onSaved,
}) {
  const isEdit = !!draw?.id;
  const [drawType, setDrawType]     = useState(draw?.draw_type || presetDrawType || 'subcontractor');
  const [subId, setSubId]           = useState(draw?.subcontract_id || presetSubcontractId || '');
  const [loanId, setLoanId]         = useState(draw?.project_loan_id || presetLoanId || '');
  const [drawNumber, setDrawNumber] = useState(draw?.draw_number ?? '');
  const [amount, setAmount]         = useState(draw?.amount ?? '');
  const [retainage, setRetainage]   = useState(draw?.retainage_held ?? 0);
  const [requestDate, setRequestDate] = useState(draw?.request_date || todayIso());
  const [paidDate, setPaidDate]     = useState(draw?.paid_date || '');
  const [status, setStatus]         = useState(draw?.status || 'pending');
  const [lwReceived, setLwReceived] = useState(!!draw?.lien_waiver_received);
  const [lwType, setLwType]         = useState(draw?.lien_waiver_type || '');
  const [notes, setNotes]           = useState(draw?.notes || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState(null);

  // Clear the field that doesn't apply to the chosen type, unless scope is locked
  useEffect(() => {
    if (scopeLocked) return;
    if (drawType !== 'subcontractor' && subId)  setSubId('');
    if (drawType !== 'loan'          && loanId) setLoanId('');
  }, [drawType, scopeLocked]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (amount === '' || isNaN(Number(amount))) { setError('Amount is required.'); return; }
    if (Number(amount) < 0) { setError('Amount cannot be negative.'); return; }
    if (lwReceived && !lwType) { setError('Pick a lien waiver type.'); return; }

    setSubmitting(true);
    const payload = {
      draw_type: drawType,
      subcontract_id: subId || null,
      project_loan_id: loanId || null,
      draw_number: drawNumber === '' ? null : Number(drawNumber),
      amount: Number(amount),
      retainage_held: retainage === '' ? 0 : Number(retainage),
      lien_waiver_received: lwReceived,
      lien_waiver_type: lwReceived ? (lwType || null) : null,
      status,
      request_date: requestDate || null,
      paid_date: paidDate || null,
      notes: notes || null,
    };
    try {
      const url = isEdit
        ? `/api/construction/projects/${projectId}/draws/${draw.id}`
        : `/api/construction/projects/${projectId}/draws`;
      const r = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(humanizeError(j.error) || `HTTP ${r.status}`);
      onSaved(j.draw);
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <header style={s.header}>
          <h3 style={s.title}>{isEdit ? 'Edit draw' : 'New draw'}</h3>
          <button onClick={onClose} style={s.closeBtn}><X size={18} /></button>
        </header>

        <form onSubmit={submit} style={s.form}>
          <Row>
            <Field label="Type" required>
              <select value={drawType} onChange={(e) => setDrawType(e.target.value)} style={s.input} disabled={scopeLocked}>
                {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Draw #" hint="Auto-assigned if blank">
              <input type="number" min="0" value={drawNumber} onChange={(e) => setDrawNumber(e.target.value)} style={s.input} />
            </Field>
          </Row>

          {drawType === 'subcontractor' && (
            <Field label="Subcontract" hint={scopeLocked ? 'Locked to current subcontract' : 'Pick a subcontract or leave blank'}>
              <select value={subId} onChange={(e) => setSubId(e.target.value)} style={s.input} disabled={scopeLocked}>
                <option value="">— none —</option>
                {subcontracts.map(sub => (
                  <option key={sub.id} value={sub.id}>
                    {sub.vendor_name || sub.vendor?.name || '(no vendor)'} — {sub.scope?.slice(0, 40)}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {drawType === 'loan' && (
            <Field label="Loan" hint={scopeLocked ? 'Locked to current loan' : 'Pick a loan or leave blank'}>
              <select value={loanId} onChange={(e) => setLoanId(e.target.value)} style={s.input} disabled={scopeLocked}>
                <option value="">— none —</option>
                {loans.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.lender_display_name || l.lender_name || '(no lender)'}{l.loan_number ? ` — #${l.loan_number}` : ''}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Row>
            <Field label="Amount" required>
              <input type="number" step="any" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" style={s.input} required />
            </Field>
            <Field label="Retainage held">
              <input type="number" step="any" min="0" value={retainage} onChange={(e) => setRetainage(e.target.value)} style={s.input} />
            </Field>
          </Row>

          <Row>
            <Field label="Status">
              <select value={status} onChange={(e) => setStatus(e.target.value)} style={s.input}>
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Request date">
              <input type="date" value={requestDate} onChange={(e) => setRequestDate(e.target.value)} style={s.input} />
            </Field>
          </Row>

          <Field label="Paid date" hint={status === 'paid' ? 'Defaults to today if blank' : 'Optional'}>
            <input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} style={s.input} />
          </Field>

          <div style={s.lienBox}>
            <label style={s.lienToggle}>
              <input type="checkbox" checked={lwReceived} onChange={(e) => setLwReceived(e.target.checked)} />
              <span>Lien waiver received</span>
            </label>
            {lwReceived && (
              <select value={lwType} onChange={(e) => setLwType(e.target.value)} style={{ ...s.input, marginTop: 8 }} required={lwReceived}>
                {LIEN_WAIVER_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}
          </div>

          <Field label="Notes">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={s.textarea} />
          </Field>

          {error && <div style={s.error}>{error}</div>}

          <div style={s.actions}>
            <button type="button" onClick={onClose} style={s.cancelBtn} disabled={submitting}>Cancel</button>
            <button type="submit" style={s.submitBtn} disabled={submitting}>
              {submitting && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
              <span>{submitting ? 'Saving…' : (isEdit ? 'Save changes' : 'Add draw')}</span>
            </button>
          </div>
        </form>

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

function humanizeError(code) {
  switch (code) {
    case 'invalid_draw_type':         return 'Pick a valid draw type.';
    case 'amount_required':           return 'Amount is required.';
    case 'amount_must_be_nonneg':     return 'Amount cannot be negative.';
    case 'invalid_status':            return 'Invalid status.';
    case 'invalid_lien_waiver_type':  return 'Pick a valid lien waiver type.';
    case 'invalid_retainage_held':    return 'Retainage held must be a non-negative number.';
    default: return code;
  }
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
  lienBox: { padding: 12, background: tokens.surfaceMuted, borderRadius: 6 },
  lienToggle: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: tokens.textPrimary, cursor: 'pointer' },
  error: { background: tokens.errorBg, color: tokens.errorText, padding: 10, borderRadius: 6, fontSize: 13 },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 },
  cancelBtn: { background: tokens.surface, color: tokens.textSecondary, border: `1px solid ${tokens.border}`, padding: '8px 16px', borderRadius: 6, fontSize: 14, cursor: 'pointer' },
  submitBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, background: tokens.primary, color: '#fff', border: 0, padding: '8px 16px', borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer' },
};
