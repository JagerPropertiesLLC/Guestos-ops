'use client';

// components/construction/ExpenseModal.js
// Create or edit an expense. Used by ExpensesSection.

import { useEffect, useState } from 'react';
import { X, Loader2, AlertTriangle } from 'lucide-react';
import { tokens, EXPENSE_PAID_STATUS_OPTIONS } from './_tokens';
import VendorPicker from './VendorPicker';

export default function ExpenseModal({ projectId, expense, phases, categories, onClose, onSaved }) {
  const isEdit = !!expense?.id;
  const [expenseDate, setExpenseDate] = useState(expense?.expense_date || todayIso());
  const [amount, setAmount] = useState(expense?.amount ?? '');
  const [description, setDescription] = useState(expense?.description || '');
  const [vendor, setVendor] = useState(expense?.vendor || (expense?.vendor_company_id ? { id: expense.vendor_company_id, name: expense.vendor_name || '' } : null));
  const [phaseId, setPhaseId] = useState(expense?.phase_id || '');
  const [categoryId, setCategoryId] = useState(expense?.budget_category_id || '');
  const [paidStatus, setPaidStatus] = useState(expense?.paid_status || 'unpaid');
  const [paidDate, setPaidDate] = useState(expense?.paid_date || '');
  const [paymentMethod, setPaymentMethod] = useState(expense?.payment_method || '');
  const [paymentReference, setPaymentReference] = useState(expense?.payment_reference || '');
  const [invoiceNumber, setInvoiceNumber] = useState(expense?.invoice_number || '');
  const [receiptUrl, setReceiptUrl] = useState(expense?.receipt_url || '');
  const [notes, setNotes] = useState(expense?.notes || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Soft over-budget warning: amount + already-paid expenses on this category > category.budgeted_amount
  const overBudgetWarning = (() => {
    if (!categoryId) return null;
    const cat = categories.find(c => c.id === categoryId);
    if (!cat) return null;
    const budgeted = Number(cat.budgeted_amount || 0);
    if (!budgeted) return null;
    const already = Number(cat.spent_paid || 0) + Number(cat.spent_unpaid || 0);
    const newAmt = Number(amount || 0);
    // If editing existing, subtract the prior amount from "already" so we don't double-count
    const adjusted = isEdit && expense.budget_category_id === categoryId ? already - Number(expense.amount || 0) : already;
    if (adjusted + newAmt > budgeted) {
      return `Over budget: this expense pushes "${cat.name}" to ${fmt(adjusted + newAmt)} of ${fmt(budgeted)} budgeted.`;
    }
    return null;
  })();

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (!amount || isNaN(Number(amount))) { setError('Amount required.'); return; }
    if (!expenseDate) { setError('Expense date required.'); return; }
    setSubmitting(true);
    const payload = {
      expense_date: expenseDate,
      amount: Number(amount),
      description: description || null,
      vendor_company_id: vendor?.id || null,
      phase_id: phaseId || null,
      budget_category_id: categoryId || null,
      paid_status: paidStatus,
      paid_date: paidStatus === 'paid' ? (paidDate || expenseDate) : (paidDate || null),
      payment_method: paymentMethod || null,
      payment_reference: paymentReference || null,
      invoice_number: invoiceNumber || null,
      receipt_url: receiptUrl || null,
      notes: notes || null,
    };
    try {
      const url = isEdit
        ? `/api/construction/projects/${projectId}/expenses/${expense.id}`
        : `/api/construction/projects/${projectId}/expenses`;
      const r = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      onSaved(j.expense);
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <header style={s.header}>
          <h3 style={s.title}>{isEdit ? 'Edit expense' : 'New expense'}</h3>
          <button onClick={onClose} style={s.closeBtn}><X size={18} /></button>
        </header>

        <form onSubmit={submit} style={s.form}>
          <Row>
            <Field label="Expense date" required>
              <input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} style={s.input} required />
            </Field>
            <Field label="Amount" required>
              <input type="number" step="any" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" style={s.input} required />
            </Field>
          </Row>

          <Field label="Vendor" hint="Start typing — picks existing or creates new on first use.">
            <VendorPicker value={vendor} onChange={setVendor} />
          </Field>

          <Field label="Description">
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What was this for?" style={s.input} />
          </Field>

          <Row>
            <Field label="Phase">
              <select value={phaseId} onChange={(e) => setPhaseId(e.target.value)} style={s.input}>
                <option value="">— untagged —</option>
                {phases.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Budget category">
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={s.input}>
                <option value="">— untagged —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          </Row>

          {overBudgetWarning && (
            <div style={s.warn}>
              <AlertTriangle size={14} />
              <span>{overBudgetWarning}</span>
            </div>
          )}

          <Row>
            <Field label="Paid status">
              <select value={paidStatus} onChange={(e) => setPaidStatus(e.target.value)} style={s.input}>
                {EXPENSE_PAID_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Paid date" hint={paidStatus === 'paid' ? 'Defaults to today if blank' : 'Optional'}>
              <input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} style={s.input} />
            </Field>
          </Row>

          <Row>
            <Field label="Payment method">
              <input type="text" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} placeholder="check, ach, card, zelle…" style={s.input} />
            </Field>
            <Field label="Payment ref">
              <input type="text" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="check #, conf #" style={s.input} />
            </Field>
          </Row>

          <Row>
            <Field label="Invoice #">
              <input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} style={s.input} />
            </Field>
            <Field label="Receipt URL" hint="Drive link or any URL — uploads come in phase 6">
              <input type="text" value={receiptUrl} onChange={(e) => setReceiptUrl(e.target.value)} placeholder="https://…" style={s.input} />
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
              <span>{submitting ? 'Saving…' : (isEdit ? 'Save changes' : 'Add expense')}</span>
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

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function fmt(n) {
  return Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

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
  warn: {
    background: '#fef3c7', color: '#854d0e',
    padding: 10, borderRadius: 6, fontSize: 13,
    display: 'flex', alignItems: 'center', gap: 8,
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
