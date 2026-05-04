'use client';

// components/construction/TaskModal.js
// Create or edit a construction-scoped task. Mirrors the patterns used by
// ExpenseModal / DrawModal.

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { tokens } from './_tokens';

const STATUS_OPTIONS = [
  { value: 'pending',     label: 'Pending' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed',   label: 'Completed' },
  { value: 'cancelled',   label: 'Cancelled' },
];
const PRIORITY_OPTIONS = [
  { value: 'low',    label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export default function TaskModal({ projectId, task, phases = [], subcontracts = [], users = [], onClose, onSaved }) {
  const isEdit = !!task?.id;
  const [title, setTitle]             = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [status, setStatus]           = useState(task?.status || 'pending');
  const [priority, setPriority]       = useState(task?.priority || 'medium');
  const [dueDate, setDueDate]         = useState(task?.due_date || '');
  const [phaseId, setPhaseId]         = useState(task?.phase_id || '');
  const [subId, setSubId]             = useState(task?.subcontract_id || '');
  const [assignee, setAssignee]       = useState(task?.assigned_to_id || '');
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) { setError('Title is required.'); return; }

    setSubmitting(true);
    const payload = {
      title: title.trim(),
      description: description || null,
      status, priority,
      due_date: dueDate || null,
      phase_id: phaseId || null,
      subcontract_id: subId || null,
      assigned_to_id: assignee || null,
    };
    try {
      const url = isEdit
        ? `/api/construction/projects/${projectId}/tasks/${task.id}`
        : `/api/construction/projects/${projectId}/tasks`;
      const r = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      onSaved(j.task);
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <header style={s.header}>
          <h3 style={s.title}>{isEdit ? 'Edit task' : 'New task'}</h3>
          <button onClick={onClose} style={s.closeBtn}><X size={18} /></button>
        </header>

        <form onSubmit={submit} style={s.form}>
          <Field label="Title" required>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} style={s.input} required autoFocus />
          </Field>

          <Field label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={s.textarea} />
          </Field>

          <Row>
            <Field label="Status">
              <select value={status} onChange={(e) => setStatus(e.target.value)} style={s.input}>
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Priority">
              <select value={priority} onChange={(e) => setPriority(e.target.value)} style={s.input}>
                {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Due date">
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={s.input} />
            </Field>
          </Row>

          <Row>
            <Field label="Phase">
              <select value={phaseId} onChange={(e) => setPhaseId(e.target.value)} style={s.input}>
                <option value="">— none —</option>
                {phases.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Subcontract">
              <select value={subId} onChange={(e) => setSubId(e.target.value)} style={s.input}>
                <option value="">— none —</option>
                {subcontracts.map(sub => (
                  <option key={sub.id} value={sub.id}>
                    {sub.vendor_name || sub.vendor?.name || '(no vendor)'} — {(sub.scope || '').slice(0, 30)}
                  </option>
                ))}
              </select>
            </Field>
          </Row>

          <Field label="Assignee" hint="Active users only">
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)} style={s.input}>
              <option value="">— unassigned —</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
            </select>
          </Field>

          {error && <div style={s.error}>{error}</div>}

          <div style={s.actions}>
            <button type="button" onClick={onClose} style={s.cancelBtn} disabled={submitting}>Cancel</button>
            <button type="submit" style={s.submitBtn} disabled={submitting}>
              {submitting && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
              <span>{submitting ? 'Saving…' : (isEdit ? 'Save changes' : 'Add task')}</span>
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
  row: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 },
  label: { fontSize: 11, color: tokens.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginBottom: 6 },
  hint: { marginTop: 4, fontSize: 11, color: tokens.textTertiary, fontStyle: 'italic' },
  input: { width: '100%', padding: '8px 10px', border: `1px solid ${tokens.border}`, borderRadius: 6, fontSize: 14, background: tokens.surface, color: tokens.textPrimary, fontFamily: 'inherit' },
  textarea: { width: '100%', padding: '8px 10px', border: `1px solid ${tokens.border}`, borderRadius: 6, fontSize: 14, background: tokens.surface, fontFamily: 'inherit', resize: 'vertical' },
  error: { background: tokens.errorBg, color: tokens.errorText, padding: 10, borderRadius: 6, fontSize: 13 },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 },
  cancelBtn: { background: tokens.surface, color: tokens.textSecondary, border: `1px solid ${tokens.border}`, padding: '8px 16px', borderRadius: 6, fontSize: 14, cursor: 'pointer' },
  submitBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, background: tokens.primary, color: '#fff', border: 0, padding: '8px 16px', borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer' },
};
