'use client'

// app/inspections/review/page.js
// Judson's queue of inspections awaiting review.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, ChevronLeft } from 'lucide-react'

export default function InspectionReviewQueue() {
  const [inspections, setInspections] = useState([])
  const [loading, setLoading] = useState(true)
  const [includeInProgress, setIncludeInProgress] = useState(false)

  async function load() {
    setLoading(true)
    const r = await fetch(`/api/inspections/review-queue${includeInProgress ? '?include_in_progress=1' : ''}`)
    const j = await r.json()
    setInspections(j.inspections || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [includeInProgress])

  return (
    <main style={S.page}>
      <Link href="/" style={S.back}><ChevronLeft size={16} /> Back</Link>
      <div style={S.header}>
        <div>
          <h1 style={S.h1}>Inspection Review Queue</h1>
          <p style={S.sub}>Submitted post-checkout inspections awaiting review.</p>
        </div>
        <label style={S.filterToggle}>
          <input type="checkbox" checked={includeInProgress} onChange={e => setIncludeInProgress(e.target.checked)} />
          Include in-progress
        </label>
      </div>

      {loading ? (
        <div style={S.skel}>Loading…</div>
      ) : inspections.length === 0 ? (
        <div style={S.empty}>Nothing to review. Sam's caught up.</div>
      ) : (
        <div style={S.list}>
          {inspections.map(i => <InspectionRow key={i.id} inspection={i} />)}
        </div>
      )}
    </main>
  )
}

function InspectionRow({ inspection }) {
  const propLabel = inspection.properties?.short_name || ''
  const unitLabel = inspection.units?.unit_label || ''
  const inspector = inspection.inspector?.full_name || inspection.inspector?.email || '—'
  const sub = inspection.finding_summary || { total: 0, billable_to_guest: 0, claim_eligible: 0, total_estimated_cents: 0 }
  const dollars = (sub.total_estimated_cents / 100).toFixed(2)

  return (
    <Link href={`/inspections/review/${inspection.id}`} style={S.row}>
      <div style={S.rowLeft}>
        <div style={S.rowTitle}>
          {propLabel}{unitLabel ? ` · ${unitLabel}` : ''}
          <StatusBadge status={inspection.status} />
        </div>
        <div style={S.rowSub}>
          {inspection.guest_name || 'no guest on record'}
          {inspection.checkout_date ? ` · ${inspection.checkout_date}` : ''}
          {' · '}{inspector}
        </div>
        <div style={S.rowMeta}>
          <span>{sub.total} finding{sub.total === 1 ? '' : 's'}</span>
          {sub.billable_to_guest > 0 && <span style={S.metaPill}>{sub.billable_to_guest} guest billable</span>}
          {sub.claim_eligible > 0 && <span style={S.metaPill}>{sub.claim_eligible} insurance</span>}
          {sub.total_estimated_cents > 0 && <span style={S.metaPill}>~${dollars}</span>}
        </div>
      </div>
      <ChevronRight size={20} color="#94a3b8" />
    </Link>
  )
}

function StatusBadge({ status }) {
  const map = {
    in_progress: { label: 'In progress', bg: '#fef3c7', text: '#92400e' },
    submitted:   { label: 'Submitted',   bg: '#dbeafe', text: '#1e40af' }
  }
  const cfg = map[status] || map.submitted
  return <span style={{ ...S.badge, background: cfg.bg, color: cfg.text }}>{cfg.label}</span>
}

const S = {
  page: { maxWidth: 900, margin: '0 auto', padding: '24px 20px', fontFamily: 'system-ui, -apple-system, sans-serif' },
  back: { display: 'inline-flex', alignItems: 'center', gap: 4, color: '#475569', fontSize: 13, textDecoration: 'none', marginBottom: 12 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12 },
  h1: { margin: 0, fontSize: 22, fontWeight: 700 },
  sub: { margin: '4px 0 0 0', fontSize: 13, color: '#64748b' },
  filterToggle: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#475569' },
  skel: { padding: 40, textAlign: 'center', color: '#94a3b8' },
  empty: { padding: 32, textAlign: 'center', color: '#64748b', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 14, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, textDecoration: 'none', color: 'inherit' },
  rowLeft: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 10 },
  rowSub: { fontSize: 13, color: '#64748b', marginTop: 4 },
  rowMeta: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6, fontSize: 12, color: '#475569' },
  metaPill: { padding: '2px 8px', background: '#f1f5f9', borderRadius: 999, fontSize: 11, fontWeight: 600 },
  badge: { padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600 }
}
