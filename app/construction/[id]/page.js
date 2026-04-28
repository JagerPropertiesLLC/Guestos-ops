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
      <Link href="/construction" style={{ color: '#64748b', fontSize: 13, textDecoration: 'none' }}>← All projects</Link>

      <div style={{ marginTop: 12, marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 26 }}>{project.name}</h1>
        <p style={{ margin: '6px 0 0', color: '#64748b' }}>
          {project.entity?.name} · {project.market?.name} · {project.address}
        </p>
      </div>

      <div style={{ borderBottom: '1px solid #e2e8f0', marginBottom: 24, display: 'flex', gap: 4, overflowX: 'auto' }}>
        <Tab active={tab === 'overview'} onClick={() => setTab('overview')}>Overview</Tab>
        <Tab active={tab === 'subcontractors'} onClick={() => setTab('subcontractors')}>Subcontractors ({counts?.subcontracts || 0})</Tab>
        <Tab active={tab === 'inspections'} onClick={() => setTab('inspections')}>Inspections ({counts?.open_inspections || 0} / {counts?.inspections || 0})</Tab>
        <Tab active={tab === 'permits'} onClick={() => setTab('permits')}>Permits</Tab>
        <Tab active={tab === 'swppp'} onClick={() => setTab('swppp')}>SWPPP ({counts?.swppp_logs || 0})</Tab>
        <Tab active={tab === 'change-orders'} onClick={() => setTab('change-orders')}>Change Orders ({counts?.change_orders || 0})</Tab>
        <Tab active={tab === 'draws'} onClick={() => setTab('draws')}>Draws & Lien Waivers</Tab>
        <Tab active={tab === 'documents'} onClick={() => setTab('documents')}>Documents</Tab>
        <Tab active={tab === 'photos'} onClick={() => setTab('photos')}>Photos</Tab>
      </div>

      {tab === 'overview' && <OverviewTab project={project} />}
      {tab === 'subcontractors' && <SubcontractorsTab projectId={id} />}
      {tab === 'inspections' && <InspectionsTab projectId={id} />}
      {tab === 'permits' && <PermitsTab projectId={id} />}
      {tab === 'swppp' && <SWPPPTab projectId={id} />}
      {tab === 'change-orders' && <ChangeOrdersTab projectId={id} />}
      {tab === 'draws' && <DrawsTab projectId={id} />}
      {tab === 'documents' && <DocumentsTab projectId={id} />}
      {tab === 'photos' && <PhotosTab projectId={id} />}
    </div>
  );
}

function Tab({ children, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: 'transparent', border: 0, padding: '10px 14px', cursor: 'pointer',
      borderBottom: active ? '2px solid #0f172a' : '2px solid transparent',
      fontWeight: active ? 600 : 400, color: active ? '#0f172a' : '#64748b',
      whiteSpace: 'nowrap', fontSize: 14
    }}>{children}</button>
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
    <div style={{ padding: 14, border: '1px solid #e2e8f0', borderRadius: 8, gridColumn: `span ${colSpan}`, background: '#fff' }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#94a3b8', marginBottom: 4, letterSpacing: 0.4 }}>{title}</div>
      <div style={{ fontSize: 15 }}>{children}</div>
    </div>
  );
}

// ---------- SUBCONTRACTORS (was "Subcontracts" — same data, renamed) ----------
function SubcontractorsTab({ projectId }) {
  const [subs, setSubs] = useState([]);
  const [redacted, setRedacted] = useState(false);

  async function load() {
    const r = await fetch(`/api/subcontracts?project_id=${projectId}`);
    const j = await r.json();
    setSubs(j.subcontracts || []);
    setRedacted(!!j.redacted);
  }
  useEffect(() => { load(); }, [projectId]);

  return (
    <div>
      <SectionHeader title="Subcontractors" />
      {redacted && <Notice>Dollar values are hidden for your role.</Notice>}
      {subs.length === 0 ? <Empty text="No subcontractors yet for this project." />
        : <Table headers={['Scope', 'Company', 'Contract value', 'Paid', 'Retained', 'Status']}>
            {subs.map(s => (
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
      }
    </div>
  );
}

// ---------- INSPECTIONS ----------
function InspectionsTab({ projectId }) {
  const [items, setItems] = useState([]);
  async function load() {
    const r = await fetch(`/api/inspections?project_id=${projectId}`);
    const j = await r.json();
    setItems(j.inspections || []);
  }
  useEffect(() => { load(); }, [projectId]);
  return (
    <div>
      <SectionHeader title="Inspections" />
      {items.length === 0 ? <Empty text="No inspections scheduled for this project." />
        : <Table headers={['Type', 'Authority', 'Scheduled', 'Completed', 'Result']}>
            {items.map(i => (
              <tr key={i.id}>
                <td style={td}>{i.inspection_type}</td>
                <td style={td}>{i.authority || '—'}</td>
                <td style={td}>{i.scheduled_date || '—'}</td>
                <td style={td}>{i.completed_date || '—'}</td>
                <td style={td}>{i.result || '—'}</td>
              </tr>
            ))}
          </Table>}
    </div>
  );
}

// ---------- PERMITS ----------
function PermitsTab({ projectId }) {
  return (
    <div>
      <SectionHeader title="Permits" />
      <Notice>Building, electrical, plumbing, mechanical, and other permits for this project. Reminders fire before expiration.</Notice>
      <Empty text="Permits API endpoint not built yet — schema is in place. Add directly in Supabase to test." />
    </div>
  );
}

// ---------- SWPPP (project-specific now) ----------
function SWPPPTab({ projectId }) {
  const [logs, setLogs] = useState([]);
  async function load() {
    const r = await fetch(`/api/swppp?project_id=${projectId}`);
    const j = await r.json();
    setLogs(j.logs || []);
  }
  useEffect(() => { load(); }, [projectId]);
  return (
    <div>
      <SectionHeader title="SWPPP Logs" />
      <Notice>Storm Water Pollution Prevention Plan inspections, rain events, and BMP work for this project.</Notice>
      {logs.length === 0 ? <Empty text="No SWPPP entries yet." />
        : <Table headers={['Date', 'Type', 'Rain (in)', 'BMP status', 'Inspector', 'Findings']}>
            {logs.map(l => (
              <tr key={l.id}>
                <td style={td}>{l.log_date}</td>
                <td style={td}>{l.log_type}</td>
                <td style={td}>{l.rain_amount_inches ?? '—'}</td>
                <td style={td}>{l.bmp_status || '—'}</td>
                <td style={td}>{l.inspector_name || '—'}</td>
                <td style={td}>{l.findings || '—'}</td>
              </tr>
            ))}
          </Table>}
    </div>
  );
}

// ---------- CHANGE ORDERS ----------
function ChangeOrdersTab({ projectId }) {
  return (
    <div>
      <SectionHeader title="Change Orders" />
      <Notice>Scope or budget changes after the original contract. Each CO impacts both project budget and schedule.</Notice>
      <Empty text="Change orders API endpoint not built yet — schema is in place." />
    </div>
  );
}

// ---------- DRAWS & LIEN WAIVERS ----------
function DrawsTab({ projectId }) {
  return (
    <div>
      <SectionHeader title="Draws & Lien Waivers" />
      <Notice>Sub pay applications, owner draws, retainage held, lien waiver tracking.</Notice>
      <Empty text="Draws API endpoint not built yet — schema is in place. Lien waiver requirement enforcement comes with the agent." />
    </div>
  );
}

// ---------- DOCUMENTS ----------
function DocumentsTab({ projectId }) {
  return (
    <div>
      <SectionHeader title="Documents" />
      <Notice>Plans, contracts, permits, COIs, photos for this project.</Notice>
      <Empty text="Document upload UI is part of the next push." />
    </div>
  );
}

// ---------- PHOTOS ----------
function PhotosTab({ projectId }) {
  return (
    <div>
      <SectionHeader title="Photos" />
      <Empty text="Project photo gallery coming next push." />
    </div>
  );
}

// ---------- shared ----------
const pageWrap = { maxWidth: 1100, margin: '0 auto', padding: '24px 28px' };
const td = { padding: '10px 12px', borderBottom: '1px solid #f1f5f9', fontSize: 14 };

function SectionHeader({ title }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
    <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>
  </div>;
}
function Empty({ text }) {
  return <div style={{ padding: 30, textAlign: 'center', background: '#f8fafc', borderRadius: 8, color: '#64748b', fontSize: 14 }}>{text}</div>;
}
function Notice({ children }) {
  return <div style={{ padding: '10px 14px', background: '#fefce8', border: '1px solid #fde68a', borderRadius: 6, fontSize: 13, marginBottom: 14, color: '#713f12' }}>{children}</div>;
}
function Table({ headers, children }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
      <thead><tr>{headers.map(h => <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4, borderBottom: '1px solid #e2e8f0', fontWeight: 600 }}>{h}</th>)}</tr></thead>
      <tbody>{children}</tbody>
    </table>
  );
}
