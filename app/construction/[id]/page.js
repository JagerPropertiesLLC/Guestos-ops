// app/construction/[id]/page.js
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function ProjectDetail() {
  const { id } = useParams();
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadProject() {
    setLoading(true);
    const r = await fetch(`/api/projects/${id}`);
    const j = await r.json();
    setData(j);
    setLoading(false);
  }

  useEffect(() => { loadProject(); }, [id]);

  if (loading) return <div style={pageWrap}><p>Loading…</p></div>;
  if (!data?.project) return <div style={pageWrap}><p>Not found.</p></div>;

  const { project, counts } = data;

  return (
    <div style={pageWrap}>
      <Link href="/construction" style={{ color: '#666', fontSize: 13, textDecoration: 'none' }}>← All projects</Link>

      <div style={{ marginTop: 12, marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 26 }}>{project.name}</h1>
        <p style={{ margin: '6px 0 0', color: '#666' }}>
          {project.entity?.name} · {project.market?.name} · {project.address}
        </p>
      </div>

      <div style={{ borderBottom: '1px solid #e5e5e5', marginBottom: 24, display: 'flex', gap: 4, overflowX: 'auto' }}>
        <Tab active={tab==='overview'} onClick={() => setTab('overview')}>Overview</Tab>
        <Tab active={tab==='subcontracts'} onClick={() => setTab('subcontracts')}>Subcontracts ({counts.subcontracts})</Tab>
        <Tab active={tab==='inspections'} onClick={() => setTab('inspections')}>Inspections ({counts.open_inspections} open / {counts.inspections})</Tab>
        <Tab active={tab==='swppp'} onClick={() => setTab('swppp')}>SWPPP ({counts.swppp_logs})</Tab>
        <Tab active={tab==='contacts'} onClick={() => setTab('contacts')}>Contacts</Tab>
      </div>

      {tab==='overview' && <OverviewTab project={project} />}
      {tab==='subcontracts' && <SubcontractsTab projectId={id} />}
      {tab==='inspections' && <InspectionsTab projectId={id} />}
      {tab==='swppp' && <SWPPPTab projectId={id} />}
      {tab==='contacts' && <ContactsTab projectId={id} marketSlug={project.market?.slug} />}
    </div>
  );
}

function Tab({ children, active, onClick }) {
  return (
    <button onClick={onClick}
      style={{ background: 'transparent', border: 0, padding: '10px 14px', cursor: 'pointer',
        borderBottom: active ? '2px solid #111' : '2px solid transparent',
        fontWeight: active ? 600 : 400, color: active ? '#111' : '#666', whiteSpace: 'nowrap' }}>
      {children}
    </button>
  );
}

// ---------- OVERVIEW ----------
function OverviewTab({ project }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <Card title="Status"><strong>{project.status}</strong></Card>
      <Card title="Type">{project.type}</Card>
      <Card title="Start date">{project.start_date || '—'}</Card>
      <Card title="Target completion">{project.target_completion || '—'}</Card>
      <Card title="Total budget">{project.total_budget != null ? `$${Number(project.total_budget).toLocaleString()}` : '—'}</Card>
      <Card title="Total spent">{project.total_spent != null ? `$${Number(project.total_spent).toLocaleString()}` : '$0'}</Card>
      <Card title="Entity (LLC)">{project.entity_name || project.entity?.name}</Card>
      <Card title="EIN">{project.entity?.ein || '—'}</Card>
      <Card title="GC" colSpan={2}>{project.gc?.name || 'Not assigned'}</Card>
      <Card title="Notes" colSpan={2}>{project.notes || '—'}</Card>
    </div>
  );
}

function Card({ title, children, colSpan = 1 }) {
  return (
    <div style={{ padding: 14, border: '1px solid #e5e5e5', borderRadius: 8, gridColumn: `span ${colSpan}` }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#888', marginBottom: 4, letterSpacing: 0.4 }}>{title}</div>
      <div style={{ fontSize: 15 }}>{children}</div>
    </div>
  );
}

// ---------- SUBCONTRACTS ----------
function SubcontractsTab({ projectId }) {
  const [subs, setSubs] = useState([]);
  const [redacted, setRedacted] = useState(false);
  const [showNew, setShowNew] = useState(false);

  async function load() {
    const r = await fetch(`/api/subcontracts?project_id=${projectId}`);
    const j = await r.json();
    setSubs(j.subcontracts || []);
    setRedacted(!!j.redacted);
  }
  useEffect(() => { load(); }, [projectId]);

  return (
    <div>
      <SectionHeader title="Subcontracts" onAdd={() => setShowNew(true)} />
      {redacted && <Notice>Dollar values are hidden for your role.</Notice>}
      {subs.length === 0 ? <Empty text="No subcontracts yet." /> : (
        <Table headers={['Scope', 'Company', 'Contract value', 'Paid', 'Retained', 'Status']}>
          {subs.map((s) => (
            <tr key={s.id}>
              <td style={td}>{s.scope}</td>
              <td style={td}>{s.company?.name || '—'}</td>
              <td style={td}>{s.contract_value != null ? `$${Number(s.contract_value).toLocaleString()}` : '—'}</td>
              <td style={td}>{s.amount_paid != null ? `$${Number(s.amount_paid).toLocaleString()}` : '—'}</td>
              <td style={td}>{s.amount_retained != null ? `$${Number(s.amount_retained).toLocaleString()}` : '—'}</td>
              <td style={td}>{s.status}</td>
            </tr>
          ))}
        </Table>
      )}
      {showNew && <NewSubcontractModal projectId={projectId} onClose={() => { setShowNew(false); load(); }} />}
    </div>
  );
}

function NewSubcontractModal({ projectId, onClose }) {
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState({ scope: '', contract_value: '', company_id: '', retainage_pct: 10, contract_signed_date: '', notes: '' });
  useEffect(() => {
    fetch('/api/companies').then(r => r.json()).then(j => setCompanies(j.companies || []));
  }, []);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  async function submit() {
    const r = await fetch('/api/subcontracts', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, ...form, contract_value: Number(form.contract_value) })
    });
    if (r.ok) onClose(); else alert(await r.text());
  }
  return (
    <Modal onClose={onClose} title="New subcontract">
      <Field label="Scope"><input value={form.scope} onChange={set('scope')} style={inputStyle} /></Field>
      <Field label="Company">
        <select value={form.company_id} onChange={set('company_id')} style={inputStyle}>
          <option value="">— Select —</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="Contract value ($)"><input type="number" value={form.contract_value} onChange={set('contract_value')} style={inputStyle} /></Field>
      <Field label="Retainage %"><input type="number" value={form.retainage_pct} onChange={set('retainage_pct')} style={inputStyle} /></Field>
      <Field label="Contract signed"><input type="date" value={form.contract_signed_date} onChange={set('contract_signed_date')} style={inputStyle} /></Field>
      <Field label="Notes"><textarea value={form.notes} onChange={set('notes')} style={{ ...inputStyle, minHeight: 60 }} /></Field>
      <ModalFooter onCancel={onClose} onSubmit={submit} canSubmit={!!form.scope && !!form.contract_value} />
    </Modal>
  );
}

// ---------- INSPECTIONS ----------
function InspectionsTab({ projectId }) {
  const [items, setItems] = useState([]);
  const [showNew, setShowNew] = useState(false);
  async function load() {
    const r = await fetch(`/api/inspections?project_id=${projectId}`);
    const j = await r.json();
    setItems(j.inspections || []);
  }
  useEffect(() => { load(); }, [projectId]);

  async function complete(insp) {
    const result = prompt('Result? (passed / failed / partial)', 'passed');
    if (!result) return;
    const r = await fetch(`/api/inspections/${insp.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ completed_date: new Date().toISOString().slice(0,10), result })
    });
    if (r.ok) load(); else alert(await r.text());
  }

  return (
    <div>
      <SectionHeader title="Inspections" onAdd={() => setShowNew(true)} />
      {items.length === 0 ? <Empty text="No inspections yet." /> : (
        <Table headers={['Type', 'Authority', 'Scheduled', 'Completed', 'Result', 'Action']}>
          {items.map((i) => (
            <tr key={i.id}>
              <td style={td}>{i.inspection_type}</td>
              <td style={td}>{i.authority || '—'}</td>
              <td style={td}>{i.scheduled_date || '—'}</td>
              <td style={td}>{i.completed_date || '—'}</td>
              <td style={td}>{i.result || '—'}</td>
              <td style={td}>{!i.completed_date && <button onClick={() => complete(i)} style={btnSmall}>Mark complete</button>}</td>
            </tr>
          ))}
        </Table>
      )}
      {showNew && <NewInspectionModal projectId={projectId} onClose={() => { setShowNew(false); load(); }} />}
    </div>
  );
}

function NewInspectionModal({ projectId, onClose }) {
  const [form, setForm] = useState({ inspection_type: 'foundation', authority: '', scheduled_date: '', notes: '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  async function submit() {
    const r = await fetch('/api/inspections', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, ...form })
    });
    if (r.ok) onClose(); else alert(await r.text());
  }
  return (
    <Modal onClose={onClose} title="Schedule inspection">
      <Field label="Type">
        <select value={form.inspection_type} onChange={set('inspection_type')} style={inputStyle}>
          {['foundation','framing','electrical_rough','plumbing_rough','mechanical','insulation','drywall','final','swppp','fire'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="Authority"><input value={form.authority} onChange={set('authority')} placeholder="City of Aurora" style={inputStyle} /></Field>
      <Field label="Scheduled date"><input type="date" value={form.scheduled_date} onChange={set('scheduled_date')} style={inputStyle} /></Field>
      <Field label="Notes"><textarea value={form.notes} onChange={set('notes')} style={{ ...inputStyle, minHeight: 60 }} /></Field>
      <ModalFooter onCancel={onClose} onSubmit={submit} canSubmit={!!form.inspection_type} />
    </Modal>
  );
}

// ---------- SWPPP ----------
function SWPPPTab({ projectId }) {
  const [logs, setLogs] = useState([]);
  const [showNew, setShowNew] = useState(false);
  async function load() {
    const r = await fetch(`/api/swppp?project_id=${projectId}`);
    const j = await r.json();
    setLogs(j.logs || []);
  }
  useEffect(() => { load(); }, [projectId]);

  return (
    <div>
      <SectionHeader title="SWPPP logs" onAdd={() => setShowNew(true)} />
      <Notice>Storm Water Pollution Prevention Plan inspections, rain events, and BMP work.</Notice>
      {logs.length === 0 ? <Empty text="No SWPPP entries yet." /> : (
        <Table headers={['Date', 'Type', 'Rain (in)', 'BMP status', 'Inspector', 'Findings']}>
          {logs.map((l) => (
            <tr key={l.id}>
              <td style={td}>{l.log_date}</td>
              <td style={td}>{l.log_type}</td>
              <td style={td}>{l.rain_amount_inches ?? '—'}</td>
              <td style={td}>{l.bmp_status || '—'}</td>
              <td style={td}>{l.inspector_name || '—'}</td>
              <td style={td}>{l.findings || '—'}</td>
            </tr>
          ))}
        </Table>
      )}
      {showNew && <NewSWPPPModal projectId={projectId} onClose={() => { setShowNew(false); load(); }} />}
    </div>
  );
}

function NewSWPPPModal({ projectId, onClose }) {
  const [form, setForm] = useState({
    log_type: 'routine_inspection', log_date: new Date().toISOString().slice(0,10),
    rain_amount_inches: '', inspector_name: '', bmp_status: 'all_good', findings: '', corrective_actions: ''
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  async function submit() {
    const r = await fetch('/api/swppp', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId, ...form,
        rain_amount_inches: form.rain_amount_inches ? Number(form.rain_amount_inches) : null
      })
    });
    if (r.ok) onClose(); else alert(await r.text());
  }
  return (
    <Modal onClose={onClose} title="New SWPPP log">
      <Field label="Type">
        <select value={form.log_type} onChange={set('log_type')} style={inputStyle}>
          <option value="routine_inspection">Routine inspection</option>
          <option value="post_rain_inspection">Post-rain inspection</option>
          <option value="rain_event">Rain event</option>
          <option value="bmp_repair">BMP repair</option>
          <option value="bmp_install">BMP install</option>
        </select>
      </Field>
      <Field label="Date"><input type="date" value={form.log_date} onChange={set('log_date')} style={inputStyle} /></Field>
      <Field label="Rain amount (inches)"><input type="number" step="0.01" value={form.rain_amount_inches} onChange={set('rain_amount_inches')} style={inputStyle} /></Field>
      <Field label="Inspector"><input value={form.inspector_name} onChange={set('inspector_name')} style={inputStyle} /></Field>
      <Field label="BMP status">
        <select value={form.bmp_status} onChange={set('bmp_status')} style={inputStyle}>
          <option value="all_good">All good</option>
          <option value="needs_repair">Needs repair</option>
          <option value="needs_replacement">Needs replacement</option>
        </select>
      </Field>
      <Field label="Findings"><textarea value={form.findings} onChange={set('findings')} style={{ ...inputStyle, minHeight: 60 }} /></Field>
      <Field label="Corrective actions"><textarea value={form.corrective_actions} onChange={set('corrective_actions')} style={{ ...inputStyle, minHeight: 60 }} /></Field>
      <ModalFooter onCancel={onClose} onSubmit={submit} canSubmit={!!form.log_type && !!form.log_date} />
    </Modal>
  );
}

// ---------- CONTACTS ----------
function ContactsTab({ projectId, marketSlug }) {
  const [contacts, setContacts] = useState([]);
  useEffect(() => {
    fetch(`/api/contacts${marketSlug ? `?market=${marketSlug}` : ''}`).then(r => r.json()).then(j => setContacts(j.contacts || []));
  }, [marketSlug]);
  return (
    <div>
      <SectionHeader title={`Contacts in ${marketSlug || 'all markets'}`} />
      <Notice>This is your full rolodex for this market. Add new contacts from the dedicated Contacts page (coming).</Notice>
      {contacts.length === 0 ? <Empty text="No contacts yet." /> : (
        <Table headers={['Name', 'Trade', 'Company', 'Phone', 'Email']}>
          {contacts.map((c) => (
            <tr key={c.id}>
              <td style={td}>{c.first_name} {c.last_name}</td>
              <td style={td}>{c.trade || '—'}</td>
              <td style={td}>{c.company?.name || '—'}</td>
              <td style={td}>{c.phone || '—'}</td>
              <td style={td}>{c.email || '—'}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

// ---------- shared bits ----------
const pageWrap = { maxWidth: 1100, margin: '0 auto', padding: '24px 20px', fontFamily: 'system-ui, -apple-system, sans-serif' };
const inputStyle = { width: '100%', padding: '8px 10px', border: '1px solid #d4d4d4', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' };
const td = { padding: '10px 12px', borderBottom: '1px solid #f0f0f0', fontSize: 14 };
const btnPrimary = { background: '#111', color: '#fff', border: 0, padding: '8px 16px', borderRadius: 6, cursor: 'pointer' };
const btnSecondary = { background: '#fff', color: '#111', border: '1px solid #d4d4d4', padding: '8px 16px', borderRadius: 6, cursor: 'pointer' };
const btnSmall = { background: '#fff', border: '1px solid #d4d4d4', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12 };

function SectionHeader({ title, onAdd }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>
      {onAdd && <button onClick={onAdd} style={btnPrimary}>+ Add</button>}
    </div>
  );
}
function Empty({ text }) {
  return <div style={{ padding: 30, textAlign: 'center', background: '#fafafa', borderRadius: 8, color: '#666' }}>{text}</div>;
}
function Notice({ children }) {
  return <div style={{ padding: '8px 12px', background: '#fefce8', border: '1px solid #fde68a', borderRadius: 6, fontSize: 13, marginBottom: 12 }}>{children}</div>;
}
function Table({ headers, children }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', border: '1px solid #e5e5e5', borderRadius: 8, overflow: 'hidden' }}>
      <thead><tr>{headers.map((h) => <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, color: '#666', textTransform: 'uppercase', letterSpacing: 0.4, borderBottom: '1px solid #e5e5e5' }}>{h}</th>)}</tr></thead>
      <tbody>{children}</tbody>
    </table>
  );
}
function Field({ label, children }) {
  return <div style={{ marginBottom: 12 }}><label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#444', marginBottom: 4 }}>{label}</label>{children}</div>;
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
function ModalFooter({ onCancel, onSubmit, canSubmit }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
      <button onClick={onCancel} style={btnSecondary}>Cancel</button>
      <button onClick={onSubmit} disabled={!canSubmit} style={btnPrimary}>Save</button>
    </div>
  );
}
