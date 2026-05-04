// app/contacts/[id]/page.js
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, User } from 'lucide-react';
import AllFilesTab from '@/components/property/AllFilesTab';

export default function ContactDetailPage() {
  const { id } = useParams();
  const [contact, setContact] = useState(null);
  const [linked, setLinked] = useState({ subcontracts: [], inspections: [], project_contacts: [], tasks: [] });
  const [tab, setTab] = useState('linked');
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const [cRes, lRes] = await Promise.all([
      fetch(`/api/contacts/${id}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/contacts/${id}/linked`).then(r => r.ok ? r.json() : null)
    ]);
    if (cRes) setContact(cRes.contact);
    if (lRes) setLinked(lRes);
    setLoading(false);
  }, [id]);

  useEffect(() => { reload(); }, [reload]);

  if (loading) return <div style={pageWrap}><p>Loading…</p></div>;
  if (!contact) return <div style={pageWrap}><p>Contact not found.</p></div>;

  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(' ');

  return (
    <div style={pageWrap}>
      <Link href="/contacts" style={backLink}><ChevronLeft size={14} /> Back to Rolodex</Link>

      <header style={{ marginTop: 12, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <User size={28} style={{ color: '#475569', marginTop: 4 }} />
        <div>
          <h1 style={{ margin: 0, fontSize: 26 }}>{fullName}</h1>
          <div style={{ marginTop: 4, color: '#64748b', fontSize: 14 }}>
            {contact.trade && <span style={pill}>{contact.trade}</span>}
            {contact.company?.name && (
              <Link href={`/companies/${contact.company.id}`} style={{ marginLeft: 10, color: '#0f172a' }}>
                @ {contact.company.name}
              </Link>
            )}
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: '#475569' }}>
            {contact.phone && <span style={{ marginRight: 16 }}>📞 {contact.phone}</span>}
            {contact.email && <span style={{ marginRight: 16 }}>✉ {contact.email}</span>}
          </div>
        </div>
      </header>

      <div style={tabBar}>
        <Tab active={tab === 'linked'} onClick={() => setTab('linked')}>Linked Records</Tab>
        <Tab active={tab === 'files'}  onClick={() => setTab('files')}>Files</Tab>
      </div>

      {tab === 'linked' && <LinkedRecords linked={linked} />}
      {tab === 'files'  && <AllFilesTab parentType="contact" parentId={id} />}
    </div>
  );
}

function LinkedRecords({ linked }) {
  const sections = [
    { key: 'subcontracts', label: 'Subcontracts',         render: (s) => <Link href={`/construction/${s.project_id}/subcontracts/${s.id}`}>{s.scope}</Link> },
    { key: 'inspections', label: 'Inspections',           render: (i) => <Link href={`/construction/${i.project_id}`}>{i.inspection_type} · {i.scheduled_date || 'unscheduled'}</Link> },
    { key: 'project_contacts', label: 'Project assignments', render: (p) => <Link href={`/construction/${p.project_id}`}>Project · {p.role_on_project}</Link> },
    { key: 'tasks',       label: 'Tasks',                  render: (t) => <Link href={`/tasks/${t.id}`}>{t.title} ({t.status})</Link> }
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
const tabBar    = { display: 'flex', gap: 4, borderBottom: '1px solid #e2e8f0', marginTop: 24, marginBottom: 20 };
const pill = { fontSize: 11, padding: '2px 8px', background: '#f1f5f9', color: '#475569', borderRadius: 4, textTransform: 'uppercase', letterSpacing: 0.4 };
const sectionHead = { fontSize: 13, fontWeight: 600, color: '#475569', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: 0.5 };
const linkedRow = { padding: '8px 0', borderTop: '1px solid #f1f5f9', fontSize: 14 };
