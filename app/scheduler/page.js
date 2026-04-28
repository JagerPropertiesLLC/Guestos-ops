// app/scheduler/page.js
'use client';

import { useEffect, useState } from 'react';
import { CalendarClock, Plus, Sparkles } from 'lucide-react';

export default function SchedulerPage() {
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [data, setData] = useState({ assignments: [], availability: null });
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewTarget, setShowNewTarget] = useState(false);

  // Date range: 14 days starting today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }
  const fromStr = days[0], toStr = days[days.length - 1];

  useEffect(() => {
    fetch('/api/users').then(r => r.ok ? r.json() : { users: [] }).catch(() => ({ users: [] }))
      .then(j => {
        setUsers(j.users || []);
        // default to Sam
        const sam = (j.users || []).find(u => u.email === 'pueblomanager@duracoproperties.com');
        if (sam) setSelectedUserId(sam.id);
        else if (j.users?.[0]) setSelectedUserId(j.users[0].id);
      });
  }, []);

  async function loadAll() {
    if (!selectedUserId) return;
    setLoading(true);
    const [a, t] = await Promise.all([
      fetch(`/api/scheduler?user_id=${selectedUserId}&from=${fromStr}&to=${toStr}`).then(r => r.json()),
      fetch(`/api/target-tasks?user_id=${selectedUserId}`).then(r => r.json())
    ]);
    setData(a);
    setTargets(t.targets || []);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, [selectedUserId]);

  async function autoFill() {
    if (!selectedUserId) return;
    const r = await fetch('/api/scheduler/auto-fill', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user_id: selectedUserId, from: fromStr, to: toStr })
    });
    const j = await r.json();
    if (j.error) alert(j.error);
    else alert(`Scheduled ${j.inserted} tasks. ${j.message || ''}`);
    loadAll();
  }

  // Group assignments by date
  const byDate = (data.assignments || []).reduce((acc, a) => {
    if (!acc[a.scheduled_date]) acc[a.scheduled_date] = [];
    acc[a.scheduled_date].push(a);
    return acc;
  }, {});

  const selectedUser = users.find(u => u.id === selectedUserId);

  return (
    <div style={{ maxWidth: 1300, margin: '0 auto', padding: '24px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26 }}>Scheduler</h1>
          <p style={{ marginTop: 4, color: '#64748b' }}>
            Cleanings come first based on STR checkouts. Target tasks fill remaining capacity.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowNewTarget(true)} style={btnSecondary}><Plus size={14} /> Add target task</button>
          <button onClick={autoFill} style={btnPrimary}><Sparkles size={14} /> Auto-fill 14 days</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 18, marginBottom: 18, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#64748b' }}>Viewing:</span>
        <select value={selectedUserId || ''} onChange={(e) => setSelectedUserId(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #d4d4d4', borderRadius: 6, fontSize: 13 }}>
          <option value="">— Select user —</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
          ))}
        </select>
        {selectedUser && data.availability && (
          <span style={{ fontSize: 12, color: '#64748b' }}>
            · Capacity: {data.availability.daily_capacity_minutes} min/day
            · Working: {[
              data.availability.available_mon && 'M',
              data.availability.available_tue && 'T',
              data.availability.available_wed && 'W',
              data.availability.available_thu && 'Th',
              data.availability.available_fri && 'F',
              data.availability.available_sat && 'Sa',
              data.availability.available_sun && 'Su'
            ].filter(Boolean).join(' ')}
          </span>
        )}
      </div>

      {loading && <p>Loading…</p>}

      {!loading && !selectedUserId && (
        <Empty title="No user selected" hint="Pick a staff member from the dropdown above." />
      )}

      {!loading && selectedUserId && (
        <>
          <h2 style={sectionH}>14-day schedule</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
            {days.map(d => {
              const dt = new Date(d + 'T00:00:00');
              const tasks = byDate[d] || [];
              const totalMins = tasks.reduce((s, t) => s + (t.estimated_minutes || 30), 0);
              const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
              return (
                <div key={d} style={{
                  background: isWeekend ? '#f8fafc' : '#fff',
                  border: '1px solid #e2e8f0', borderRadius: 6, padding: 8, minHeight: 110
                }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
                    {dt.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
                    {dt.getDate()}
                  </div>
                  {tasks.length === 0 ? (
                    <div style={{ fontSize: 11, color: '#cbd5e1' }}>—</div>
                  ) : (
                    <>
                      {tasks.slice(0, 4).map(t => (
                        <div key={t.id} style={{
                          fontSize: 11, padding: '3px 5px', borderRadius: 4, marginBottom: 2,
                          background: t.priority <= 20 ? '#dcfce7' : t.priority <= 60 ? '#fef3c7' : '#dbeafe',
                          color: t.priority <= 20 ? '#166534' : t.priority <= 60 ? '#92400e' : '#1e40af',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                        }}>
                          {t.title}
                        </div>
                      ))}
                      {tasks.length > 4 && <div style={{ fontSize: 10, color: '#64748b' }}>+{tasks.length - 4} more</div>}
                      <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>{totalMins} min</div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <h2 style={sectionH}>Target tasks ({targets.length})</h2>
          {targets.length === 0 ? (
            <Empty title="No target tasks yet"
              hint="Target tasks are recurring jobs you want done weekly/monthly/etc. The scheduler auto-fills them when capacity allows. Click 'Add target task' above to create one." />
          ) : (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Title','Property','Recurrence','Time','Priority','Module'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #e2e8f0', fontWeight: 600 }}>{h}</th>
                ))}</tr></thead>
                <tbody>
                  {targets.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={td}><strong>{t.title}</strong>{t.description && <div style={{ fontSize: 12, color: '#64748b' }}>{t.description}</div>}</td>
                      <td style={td}>{t.property?.short_name || '— (any)'}</td>
                      <td style={td}>{t.recurrence}</td>
                      <td style={td}>{t.estimated_minutes} min</td>
                      <td style={td}>{t.priority}</td>
                      <td style={td}>{t.module}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {showNewTarget && (
        <NewTargetModal
          users={users} defaultUserId={selectedUserId}
          onClose={() => { setShowNewTarget(false); loadAll(); }}
        />
      )}
    </div>
  );
}

function NewTargetModal({ onClose, users, defaultUserId }) {
  const [props, setProps] = useState([]);
  const [form, setForm] = useState({
    title: '', description: '', estimated_minutes: 30, recurrence: 'monthly',
    preferred_assignee_user_id: defaultUserId || '',
    priority: 'normal', module: 'str', property_id: '', preferred_day_of_week: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/sidebar-nav').then(r => r.json()).then(d => setProps(d.properties || []));
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const valid = form.title && form.preferred_assignee_user_id && form.estimated_minutes && form.recurrence && form.module && form.priority && form.description;

  async function submit() {
    setSubmitting(true);
    const payload = {
      ...form,
      estimated_minutes: parseInt(form.estimated_minutes, 10),
      property_id: form.property_id || null,
      preferred_day_of_week: form.preferred_day_of_week === '' ? null : parseInt(form.preferred_day_of_week, 10)
    };
    const r = await fetch('/api/target-tasks', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    setSubmitting(false);
    if (r.ok) onClose();
    else alert(await r.text());
  }

  return (
    <Modal onClose={onClose} title="New target task">
      <Field label="Title *" required>
        <input value={form.title} onChange={set('title')} style={inputStyle} placeholder="Replace HVAC filters" required />
      </Field>
      <Field label="Description *" required>
        <textarea value={form.description} onChange={set('description')} style={{ ...inputStyle, minHeight: 60 }} required />
      </Field>
      <Field label="Assigned to *" required>
        <select value={form.preferred_assignee_user_id} onChange={set('preferred_assignee_user_id')} style={inputStyle} required>
          <option value="">— Select —</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
        </select>
      </Field>
      <Field label="Recurrence *" required>
        <select value={form.recurrence} onChange={set('recurrence')} style={inputStyle} required>
          <option value="weekly">Weekly</option>
          <option value="biweekly">Biweekly</option>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="annual">Annual</option>
          <option value="one_time">One time</option>
        </select>
      </Field>
      <Field label="Estimated time (min) *" required>
        <input type="number" value={form.estimated_minutes} onChange={set('estimated_minutes')} style={inputStyle} required min="5" />
      </Field>
      <Field label="Priority *" required>
        <select value={form.priority} onChange={set('priority')} style={inputStyle} required>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>
      </Field>
      <Field label="Module *" required>
        <select value={form.module} onChange={set('module')} style={inputStyle} required>
          <option value="str">Short Term</option>
          <option value="ltr">Long Term</option>
          <option value="construction">Construction</option>
          <option value="admin">Admin</option>
        </select>
      </Field>
      <Field label="Property (optional)">
        <select value={form.property_id} onChange={set('property_id')} style={inputStyle}>
          <option value="">— Any —</option>
          {props.map(p => <option key={p.id} value={p.id}>{p.short_name}</option>)}
        </select>
      </Field>
      <Field label="Preferred day of week (optional)">
        <select value={form.preferred_day_of_week} onChange={set('preferred_day_of_week')} style={inputStyle}>
          <option value="">— Any —</option>
          <option value="0">Sunday</option><option value="1">Monday</option><option value="2">Tuesday</option>
          <option value="3">Wednesday</option><option value="4">Thursday</option><option value="5">Friday</option>
          <option value="6">Saturday</option>
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

const sectionH = { fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.6, color: '#64748b', marginTop: 28, marginBottom: 12 };
const inputStyle = { width: '100%', padding: '8px 10px', border: '1px solid #d4d4d4', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' };
const td = { padding: 12, fontSize: 14 };
const btnPrimary = { background: '#0f172a', color: '#fff', border: 0, padding: '10px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 };
const btnSecondary = { background: '#fff', color: '#0f172a', border: '1px solid #d4d4d4', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 };

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
