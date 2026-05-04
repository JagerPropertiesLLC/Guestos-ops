// app/companies/[id]/page.js
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, AlertTriangle, Building2 } from 'lucide-react';
import RequiredDocsTab from '@/components/property/RequiredDocsTab';
import AllFilesTab from '@/components/property/AllFilesTab';

export default function CompanyDetailPage() {
  const { id } = useParams();
  const [company, setCompany] = useState(null);
  const [reqDocs, setReqDocs] = useState({ slots: [], grouped: {}, summary: { required: 0, fulfilled: 0, not_applicable: 0 } });
  const [linked, setLinked] = useState({ subcontracts: [], inspections: [], coi_records: [], project_contacts: [] });
  const [tab, setTab] = useState('required');
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const [cRes, dRes, lRes] = await Promise.all([
      fetch(`/api/companies/${id}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/companies/${id}/required-docs`).then(r => r.ok ? r.json() : null),
      fetch(`/api/companies/${id}/linked`).then(r => r.ok ? r.json() : null)
    ]);
    if (cRes) setCompany(cRes.company);
    if (dRes) setReqDocs(dRes);
    if (lRes) setLinked(lRes);
    setLoading(false);
  }, [id]);

  useEffect(() => { reload(); }, [reload]);

  if (loading) return <div style={pageWrap}><p>Loading…</p></div>;
  if (!company) return <div style={pageWrap}><p>Company not found.</p></div>;

  const isSub = company.type === 'sub';
  const summary = reqDocs.summary;
  const missing = summary.required;
  const total = summary.required + summary.fulfilled + summary.not_applicable;

  return (
    <div style={pageWrap}>
      <Link href="/contacts" style={backLink}><ChevronLeft size={14} /> Back to Rolodex</Link>

      <header style={{ marginTop: 12, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <Building2 size={28} style={{ color: '#475569', marginTop: 4 }} />
        <div>
          <h1 style={{ margin: 0, fontSize: 26 }}>{company.name}</h1>
          <div style={{ marginTop: 4, color: '#64748b', fontSize: 14 }}>
            {company.type && <span style={pill}>{company.type}</span>}
            {company.market?.name && <span style={{ marginLeft: 10 }}>{company.market.name}</span>}
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: '#475569' }}>
            {company.phone && <span style={{ marginRight: 16 }}>📞 {company.phone}</span>}
            {company.email && <span style={{ marginRight: 16 }}>✉ {company.email}</span>}
            {company.website && <a href={company.website} target="_blank" rel="noreferrer">{company.website}</a>}
          </div>
        </div>
      </header>

      {isSub && missing > 0 && (
        <div style={banner} onClick={() => setTab('required')}>
          <AlertTriangle size={18} />
          <span>{missing} of {total} required subcontractor documents missing</span>
          <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 500 }}>Upload Documents →</span>
        </div>
      )}

      <div style={tabBar}>
        {isSub && (
          <Tab active={tab === 'required'} onClick={() => setTab('required')}>
            Required Documents ({summary.fulfilled}/{summary.fulfilled + summary.required})
          </Tab>
        )}
        <Tab active={tab === 'files'} onClick={() => setTab('files')}>All Files</Tab>
        <Tab active={tab === 'linked'} onClick={() => setTab('linked')}>Linked Records</Tab>
      </div>

      {tab === 'required' && isSub && (
        <RequiredDocsTab parentType="company" parentId={id} reqDocs={reqDocs} onChange={reload} />
      )}
      {tab === 'files'  && <AllFilesTab parentType="company" parentId={id} />}
      {tab === 'linked' && <LinkedRecords linked={linked} />}
    </div>
  );
}

function LinkedRecords({ linked }) {
  const sections = [
    { key: 'subcontracts', label: 'Subcontracts',         render: (s) => <Link href={`/construction/${s.project_id}/subcontracts/${s.id}`}>{s.scope}</Link> },
    { key: 'inspections', label: 'Inspections',           render: (i) => <Link href={`/construction/${i.project_id}`}>{i.inspection_type} · {i.scheduled_date || 'unscheduled'}</Link> },
    { key: 'coi_records', label: 'Insurance certificates', render: (c) => <span>{c.insurer || 'Unknown insurer'} · expires {c.expiration_date}</span> },
    { key: 'project_contacts', label: 'Project assignments', render: (p) => <Link href={`/construction/${p.project_id}`}>Project · {p.role_on_project}</Link> }
  ];

  const empty = sections.every(s => (linked[s.key] || []).length === 0);
  if (empty) return <p style={{ color: '#64748b' }}>No linked records yet.</p>;

  return (
    <div>
      {sections.map(s => {
        const rows = linked[s.key] || [];
        if (rows.length === 0) return null;
        return (
          <section key={s.key} style={{ marginBottom: 20 }}>
            <h3 style={sectionHead}>{s.label} ({rows.length})</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {rows.map((row, i) => (
                <li key={row.id || i} style={linkedRow}>{s.render(row)}</li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function Tab({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      background: 'transparent', border: 0, padding: '10px 14px', cursor: 'pointer',
      borderBottom: active ? '2px solid #0f172a' : '2px solid transparent',
      fontWeight: active ? 600 : 400, color: active ? '#0f172a' : '#64748b', fontSize: 14
    }}>{children}</button>
  );
}

const pageWrap = { maxWidth: 1100, margin: '0 auto', padding: '24px 28px' };
const backLink = { color: '#64748b', textDecoration: 'none', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 };
const banner   = {
  marginTop: 20, padding: '12px 16px', background: '#fffbeb', border: '1px solid #fde68a',
  borderRadius: 8, color: '#92400e', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer'
};
const tabBar    = { display: 'flex', gap: 4, borderBottom: '1px solid #e2e8f0', marginTop: 24, marginBottom: 20 };
const pill = { fontSize: 11, padding: '2px 8px', background: '#f1f5f9', color: '#475569', borderRadius: 4, textTransform: 'uppercase', letterSpacing: 0.4 };
const sectionHead = { fontSize: 13, fontWeight: 600, color: '#475569', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: 0.5 };
const linkedRow = { padding: '8px 0', borderTop: '1px solid #f1f5f9', fontSize: 14 };
