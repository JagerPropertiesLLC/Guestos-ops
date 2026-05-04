'use client';

// components/construction/InspectionModal.js
// Create or edit a construction inspection.

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { tokens } from './_tokens';
import VendorPicker from './VendorPicker';

const RESULT_OPTIONS = [
  { value: '',                  label: '— not yet —' },
  { value: 'passed',            label: 'Passed' },
  { value: 'failed',            label: 'Failed' },
  { value: 'conditional_pass',  label: 'Conditional pass' },
  { value: 'rescheduled',       label: 'Rescheduled' },
];

export default function InspectionModal({ projectId, inspection, commonTypes = [], onClose, onSaved }) {
  const isEdit = !!inspection?.id;
  const [type, setType]                 = useState(inspection?.inspection_type || '');
  const [authority, setAuthority]       = useState(inspection?.authority || '');
  const [inspector, setInspector]       = useState(
    inspection?.inspector || (inspection?.inspector_company_id ? { id: inspection.inspector_company_id, name: inspection.inspector_name || '' } : null)
  );
  const [scheduled, setScheduled]       = useState(inspection?.scheduled_date || '');
  const [completed, setCompleted]       = useState(inspection?.completed_date || '');
  const [result, setResult]             = useState(inspection?.result || '');
  const [failureNotes, setFailureNotes] = useState(inspection?.failure_notes || '');
  const [followup, setFollowup]         = useState(!!inspection?.followup_required);
  const [followupDate, setFollowupDate] = useState(inspection?.followup_date || '');
  const [notes, setNotes]               = useState(inspection?.notes || '');
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (!type.trim()) { setError('Inspection type is required.'); return; }

    setSubmitting(true);
    const payload = {
      inspection_type: type.trim(),
      authority: authority || null,
      inspector_company_id: inspector?.id || null,
      scheduled_date: scheduled || null,
      completed_date: completed || null,
      result: result || null,
      failure_notes: failureNotes || null,
      followup_required: followup,
      followup_date: followupDate || null,
      notes: notes || null,
    };
    try {
      const url = isEdit
        ? `/api/construction/projects/${projectId}/inspections/${inspection.id}`
        : `/api/construction/projects/${projectId}/inspections`;
      const r = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      onSaved(j.inspection);
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <header style={s.header}>
          <h3 style={s.title}>{isEdit ? 'Edit inspection' : 'New inspection'}</h3>
          <button onClick={onClose} style={s.closeBtn}><X size={18} /></button>
        </header>

        <form onSubmit={submit} style={s.form}>
          <Row>
            <Field label="Inspection type" required hint="Free text — common values listed">
              <input list="inspection-types" type="text" value={type} onChange={(e) => setType(e.target.value)} placeholder="Building, Electrical, Final, …" style={s.input} required autoFocus />
              <datalist id="inspection-types">
                {commonTypes.map(t => <option key={t} value={t} />)}
              </datalist>
            </Field>
            <Field label="Authority" hint="e.g. City of Denver Building Dept">
              <input type="text" value={authority} onChange={(e) => setAuthority(e.target.value)} style={s.input} />
            </Field>
          </Row>

          <Field label="Inspector" hint="Optional company; create new if not in the list">
            <VendorPicker value={inspector} onChange={setInspector} placeholder="Inspector company…" companyType="inspector" />
          </Field>

          <Row>
            <Field label="Scheduled date">
              <input type="date" value={scheduled} onChange={(e) => setScheduled(e.target.value)} style={s.input} />
            </Field>
            <Field label="Completed date" hint={result ? 'Defaults to today if blank when result is set' : 'Optional'}>
              <input type="date" value={completed} onChange={(e) => setCompleted(e.target.value)} style={s.input} />
            </Field>
          </Row>

          <Field label="Result">
            <select value={result} onChange={(e) => setResult(e.target.value)} style={s.input}>
              {RESULT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>

          {result === 'failed' && (
            <Field label="Failure notes">
              <textarea value={failureNotes} onChange={(e) => setFailureNotes(e.target.value)} rows={2} style={s.textarea} />
            </Field>
          )}

          <div style={s.followBox}>
            <label style={s.followToggle}>
              <input type="checkbox" checked={followup} onChange={(e) => setFollowup(e.target.checked)} />
              <span>Follow-up required</span>
            </label>
            {followup && (
              <input type="date" value={followupDate} onChange={(e) => setFollowupDate(e.target.value)} style={{ ...s.input, marginTop: 8 }} placeholder="Follow-up date" />
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
              <span>{submitting ? 'Saving…' : (isEdit ? 'Save changes' : 'Add inspection')}</span>
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
  followBox: { padding: 12, background: tokens.surfaceMuted, borderRadius: 6 },
  followToggle: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: tokens.textPrimary, cursor: 'pointer' },
  error: { background: tokens.errorBg, color: tokens.errorText, padding: 10, borderRadius: 6, fontSize: 13 },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 },
  cancelBtn: { background: tokens.surface, color: tokens.textSecondary, border: `1px solid ${tokens.border}`, padding: '8px 16px', borderRadius: 6, fontSize: 14, cursor: 'pointer' },
  submitBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, background: tokens.primary, color: '#fff', border: 0, padding: '8px 16px', borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer' },
};
