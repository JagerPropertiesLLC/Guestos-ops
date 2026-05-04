// components/property/PropertyDetail.js
// Shared property detail page for /short-term/properties/[id] and
// /long-term/properties/[id]. Renders header, required-docs banner, and three
// tabs: Required Documents | All Files | Daily Photos / Site Visits.
'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeft, AlertTriangle } from 'lucide-react';
import RequiredDocsTab from './RequiredDocsTab';
import AllFilesTab from './AllFilesTab';
import SiteVisitsTab from './SiteVisitsTab';

export default function PropertyDetail({ propertyId, module: mod }) {
  const [property, setProperty] = useState(null);
  const [units, setUnits] = useState([]);
  const [reqDocs, setReqDocs] = useState({ slots: [], grouped: {}, summary: { required: 0, fulfilled: 0, not_applicable: 0 } });
  const [tab, setTab] = useState('required');
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const [pRes, dRes] = await Promise.all([
      fetch(`/api/properties/${propertyId}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/properties/${propertyId}/required-docs`).then(r => r.ok ? r.json() : null)
    ]);
    if (pRes) {
      setProperty(pRes.property);
      setUnits(pRes.units || []);
    }
    if (dRes) setReqDocs(dRes);
    setLoading(false);
  }, [propertyId]);

  useEffect(() => { reload(); }, [reload]);

  if (loading) return <div style={pageWrap}><p>Loading…</p></div>;
  if (!property) return <div style={pageWrap}><p>Property not found.</p></div>;

  const summary = reqDocs.summary;
  const missing = summary.required;
  const total = summary.required + summary.fulfilled + summary.not_applicable;

  return (
    <div style={pageWrap}>
      <Link href={`/${mod}`} style={backLink}><ChevronLeft size={14} /> Back to {mod === 'short-term' ? 'Short Term' : 'Long Term'}</Link>

      <header style={{ marginTop: 12 }}>
        <h1 style={{ margin: 0, fontSize: 26 }}>{property.short_name}</h1>
        <p style={{ marginTop: 4, color: '#64748b' }}>{property.full_address}</p>
        <div style={{ marginTop: 6, fontSize: 13, color: '#94a3b8' }}>
          {property.entity?.name}
          {property.market?.name && <> · {property.market.name}</>}
          {' · '}
          {(property.property_type || []).join(' / ').toUpperCase() || 'UNCLASSIFIED'}
          {units.length > 0 && <> · {units.length} unit{units.length === 1 ? '' : 's'}</>}
        </div>
      </header>

      {missing > 0 && (
        <div style={banner} onClick={() => setTab('required')}>
          <AlertTriangle size={18} />
          <span>{missing} of {total} required documents missing</span>
          <span style={bannerCta}>Upload Documents →</span>
        </div>
      )}

      <div style={tabBar}>
        <Tab active={tab === 'required'} onClick={() => setTab('required')}>
          Required Documents ({summary.fulfilled}/{summary.fulfilled + summary.required})
        </Tab>
        <Tab active={tab === 'all'} onClick={() => setTab('all')}>All Files</Tab>
        <Tab active={tab === 'photos'} onClick={() => setTab('photos')}>Daily Photos / Site Visits</Tab>
      </div>

      {tab === 'required' && <RequiredDocsTab propertyId={propertyId} reqDocs={reqDocs} onChange={reload} />}
      {tab === 'all'      && <AllFilesTab parentType="property" parentId={propertyId} property={property} />}
      {tab === 'photos'   && <SiteVisitsTab propertyId={propertyId} property={property} />}
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
const bannerCta = { marginLeft: 'auto', fontSize: 13, fontWeight: 500 };
const tabBar    = { display: 'flex', gap: 4, borderBottom: '1px solid #e2e8f0', marginTop: 24, marginBottom: 20 };
