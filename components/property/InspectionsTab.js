// components/property/InspectionsTab.js
// History of post-checkout unit inspections for a property (Phase 7a).
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardCheck } from 'lucide-react';

export default function InspectionsTab({ propertyId }) {
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch(`/api/inspections/units?property_id=${propertyId}&limit=100`)
      .then(r => r.json())
      .then(j => { if (alive) { setInspections(j.inspections || []); setLoading(false); } });
    return () => { alive = false; };
  }, [propertyId]);

  if (loading) return <div style={{ color: '#94a3b8' }}>Loading…</div>;
  if (inspections.length === 0) return (
    <div style={empty}>
      <ClipboardCheck size={32} color="#cbd5e1" />
      <div style={{ fontSize: 14, marginTop: 8 }}>No inspections recorded yet for this property.</div>
    </div>
  );

  return (
    <div>
      {inspections.map(i => <Row key={i.id} inspection={i} />)}
    </div>
  );
}

function Row({ inspection }) {
  const unitLabel = inspection.units?.unit_label || 'whole property';
  const inspector = inspection.inspector?.full_name || inspection.inspector?.email || '—';
  const reviewerLink = inspection.status === 'submitted'
    ? `/inspections/review/${inspection.id}`
    : `/inspections/${inspection.id}`;

  return (
    <Link href={reviewerLink} style={row}>
      <div style={{ flex: 1 }}>
        <div style={rowTitle}>
          {unitLabel}
          <StatusBadge status={inspection.status} />
        </div>
        <div style={rowSub}>
          {inspection.guest_name || 'no guest on record'}
          {inspection.checkout_date ? ` · ${inspection.checkout_date}` : ''}
          {' · '}
          inspected by {inspector}
        </div>
        <div style={rowMeta}>
          {inspection.finding_count || 0} finding{(inspection.finding_count || 0) === 1 ? '' : 's'}
        </div>
      </div>
    </Link>
  );
}

function StatusBadge({ status }) {
  const map = {
    in_progress: { label: 'In progress', bg: '#fef3c7', text: '#92400e' },
    submitted:   { label: 'Submitted',   bg: '#dbeafe', text: '#1e40af' },
    reviewed:    { label: 'Reviewed',    bg: '#dcfce7', text: '#166534' },
    closed:      { label: 'Closed',      bg: '#f3f4f6', text: '#374151' }
  };
  const cfg = map[status] || map.closed;
  return <span style={{ ...badge, background: cfg.bg, color: cfg.text }}>{cfg.label}</span>;
}

const row = { display: 'block', padding: 14, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, marginBottom: 10, textDecoration: 'none', color: 'inherit' };
const rowTitle = { fontSize: 15, fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 10 };
const rowSub = { fontSize: 13, color: '#64748b', marginTop: 4 };
const rowMeta = { fontSize: 12, color: '#475569', marginTop: 4 };
const badge = { padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600 };
const empty = { padding: 32, textAlign: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, color: '#64748b' };
