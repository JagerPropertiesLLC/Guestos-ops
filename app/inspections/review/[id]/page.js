'use client'

// app/inspections/review/[id]/page.js
// Judson reviews a submitted inspection. Sees all findings + photos. For each
// finding can choose: charge guest, file insurance claim, both, or skip.
// Then promotes selections into pending_charges / pending_insurance_claims.

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

const ACTIONS = [
  { value: 'skip', label: 'Skip', desc: 'No action' },
  { value: 'charge', label: 'Bill guest', desc: 'Add to pending charges' },
  { value: 'claim', label: 'Insurance', desc: 'File a claim' },
  { value: 'both', label: 'Both', desc: 'Charge + claim' }
]

export default function InspectionReviewDetail() {
  const router = useRouter()
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [decisions, setDecisions] = useState({})  // findingId -> { action, amount_cents, claim_amount_cents }
  const [reviewNotes, setReviewNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    const r = await fetch(`/api/inspections/units/${id}`)
    if (r.status === 404) { setError('Not found.'); setLoading(false); return }
    const j = await r.json()
    if (!r.ok) { setError(j.error || 'Error'); setLoading(false); return }
    setData(j)
    setReviewNotes(j.inspection.review_notes || '')
    // Pre-populate decisions: if charge_to=guest default to charge, claim_eligible default to claim, both => both
    const init = {}
    for (const f of j.findings) {
      const wantCharge = f.charge_to === 'guest'
      const wantClaim = !!f.claim_eligible
      let action = 'skip'
      if (wantCharge && wantClaim) action = 'both'
      else if (wantCharge) action = 'charge'
      else if (wantClaim) action = 'claim'
      init[f.id] = {
        action,
        amount_cents: f.estimated_cost_cents,
        claim_amount_cents: f.estimated_cost_cents
      }
    }
    setDecisions(init)
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  function setAction(findingId, action) {
    setDecisions(prev => ({ ...prev, [findingId]: { ...prev[findingId], action } }))
  }
  function setAmount(findingId, key, dollars) {
    const cents = dollars ? Math.round(parseFloat(dollars) * 100) : null
    setDecisions(prev => ({ ...prev, [findingId]: { ...prev[findingId], [key]: cents } }))
  }

  async function saveNotes() {
    await fetch(`/api/inspections/units/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ review_notes: reviewNotes })
    })
  }

  async function promote(closeAfter) {
    const findings = Object.entries(decisions)
      .filter(([_, d]) => d.action !== 'skip')
      .map(([finding_id, d]) => ({
        finding_id,
        action: d.action,
        amount_cents: d.action === 'charge' || d.action === 'both' ? d.amount_cents : undefined,
        claim_amount_cents: d.action === 'claim' || d.action === 'both' ? d.claim_amount_cents : undefined
      }))

    if (findings.length === 0 && !closeAfter) {
      if (!confirm('No findings selected to charge or claim. Just mark this inspection reviewed?')) return
    }

    setSubmitting(true)
    await saveNotes()

    if (findings.length > 0) {
      const r = await fetch(`/api/inspections/units/${id}/promote`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ findings, close: closeAfter })
      })
      const j = await r.json()
      setSubmitting(false)
      if (!r.ok) { alert(j.error || 'Promote failed'); return }
      alert(`Created ${j.pending_charges.length} charge(s) and ${j.pending_insurance_claims.length} claim(s).`)
    } else {
      // No promotions but still want to mark reviewed/closed.
      await fetch(`/api/inspections/units/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: closeAfter ? 'closed' : 'reviewed' })
      })
      setSubmitting(false)
    }

    router.push('/inspections/review')
  }

  if (loading) return <main style={S.page}><div style={S.skel}>Loading…</div></main>
  if (error) return <main style={S.page}><div style={S.errorBox}>{error}</div></main>

  const { inspection, findings, photos } = data
  const propLabel = inspection.properties?.short_name || ''
  const unitLabel = inspection.units?.unit_label || ''
  const isReviewed = inspection.status === 'reviewed' || inspection.status === 'closed'

  return (
    <main style={S.page}>
      <Link href="/inspections/review" style={S.back}><ChevronLeft size={16} /> Back to queue</Link>

      <div style={S.headerCard}>
        <div style={S.headerTitle}>{propLabel}{unitLabel ? ` · ${unitLabel}` : ''}</div>
        <div style={S.headerSub}>
          {inspection.guest_name || 'no guest on record'}
          {inspection.checkout_date ? ` · checked out ${inspection.checkout_date}` : ''}
          {inspection.inspector?.full_name ? ` · inspected by ${inspection.inspector.full_name}` : ''}
        </div>
        {inspection.damage_summary && (
          <div style={S.summaryBox}>
            <strong>Sam's summary:</strong> {inspection.damage_summary}
          </div>
        )}
      </div>

      {photos.length > 0 && (
        <section style={S.section}>
          <div style={S.sectionTitle}>General photos</div>
          <div style={S.photoGrid}>
            {photos.map(p => (
              <a key={p.id} href={p.download_url} target="_blank" rel="noreferrer" style={S.photoTile}>
                <img src={p.download_url} alt={p.title} style={S.photoImg} />
              </a>
            ))}
          </div>
        </section>
      )}

      <section style={S.section}>
        <div style={S.sectionTitle}>Findings</div>
        {findings.length === 0 && <div style={S.emptyHint}>No findings logged.</div>}
        {findings.map(f => (
          <FindingReviewRow
            key={f.id}
            finding={f}
            decision={decisions[f.id] || { action: 'skip' }}
            onSetAction={(a) => setAction(f.id, a)}
            onSetAmount={(k, v) => setAmount(f.id, k, v)}
            disabled={isReviewed}
          />
        ))}
      </section>

      <section style={S.section}>
        <div style={S.sectionTitle}>Review notes</div>
        <textarea
          value={reviewNotes}
          onChange={e => setReviewNotes(e.target.value)}
          rows={3}
          placeholder="Notes for the file (optional)"
          disabled={isReviewed}
          style={S.textarea}
        />
      </section>

      {!isReviewed && (
        <div style={S.actionRow}>
          <button onClick={() => promote(false)} disabled={submitting} style={S.btnSecondary}>
            {submitting ? 'Saving…' : 'Mark reviewed'}
          </button>
          <button onClick={() => promote(true)} disabled={submitting} style={S.btnPrimary}>
            {submitting ? 'Saving…' : 'Close inspection'}
          </button>
        </div>
      )}
      {isReviewed && (
        <div style={S.reviewedBox}>This inspection has already been {inspection.status}.</div>
      )}
    </main>
  )
}

function FindingReviewRow({ finding, decision, onSetAction, onSetAmount, disabled }) {
  const dollars = decision.amount_cents != null ? (decision.amount_cents / 100).toString() : ''
  const claimDollars = decision.claim_amount_cents != null ? (decision.claim_amount_cents / 100).toString() : ''
  const showCharge = decision.action === 'charge' || decision.action === 'both'
  const showClaim = decision.action === 'claim' || decision.action === 'both'

  return (
    <div style={S.findingRow}>
      <div style={S.findingChips}>
        <span style={S.chip}>{finding.finding_type.replace('_', ' ')}</span>
        <span style={S.chip}>{finding.severity}</span>
        {finding.estimated_cost_cents != null && (
          <span style={S.chip}>est. ${(Number(finding.estimated_cost_cents) / 100).toFixed(2)}</span>
        )}
      </div>
      <div style={S.findingDesc}>{finding.description}</div>
      {(finding.photos || []).length > 0 && (
        <div style={S.photoGridCompact}>
          {finding.photos.map(p => (
            <a key={p.id} href={p.download_url} target="_blank" rel="noreferrer" style={S.photoTile}>
              <img src={p.download_url} alt={p.title} style={S.photoImg} />
            </a>
          ))}
        </div>
      )}
      <div style={S.actionGrid}>
        {ACTIONS.map(a => (
          <button
            key={a.value}
            onClick={() => onSetAction(a.value)}
            disabled={disabled}
            style={{
              ...S.actionBtn,
              ...(decision.action === a.value ? S.actionBtnActive : {})
            }}
          >
            <div style={S.actionLabel}>{a.label}</div>
            <div style={S.actionDesc}>{a.desc}</div>
          </button>
        ))}
      </div>
      {showCharge && (
        <div style={S.amountRow}>
          <label style={S.amountLabel}>Charge $</label>
          <input
            type="number" inputMode="decimal" value={dollars}
            onChange={e => onSetAmount('amount_cents', e.target.value)}
            disabled={disabled}
            style={S.input}
          />
        </div>
      )}
      {showClaim && (
        <div style={S.amountRow}>
          <label style={S.amountLabel}>Claim $</label>
          <input
            type="number" inputMode="decimal" value={claimDollars}
            onChange={e => onSetAmount('claim_amount_cents', e.target.value)}
            disabled={disabled}
            style={S.input}
          />
        </div>
      )}
    </div>
  )
}

const S = {
  page: { maxWidth: 820, margin: '0 auto', padding: '24px 20px 80px', fontFamily: 'system-ui, -apple-system, sans-serif' },
  back: { display: 'inline-flex', alignItems: 'center', gap: 4, color: '#475569', fontSize: 13, textDecoration: 'none', marginBottom: 12 },
  skel: { padding: 40, textAlign: 'center', color: '#94a3b8' },
  errorBox: { padding: 16, background: '#fef2f2', color: '#991b1b', borderRadius: 8 },
  headerCard: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginBottom: 12 },
  headerTitle: { fontSize: 18, fontWeight: 700, color: '#0f172a' },
  headerSub: { fontSize: 13, color: '#64748b', marginTop: 4 },
  summaryBox: { marginTop: 10, padding: 10, background: '#f8fafc', borderRadius: 8, fontSize: 14, color: '#334155' },
  section: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  emptyHint: { fontSize: 13, color: '#94a3b8' },
  findingRow: { padding: 12, border: '1px solid #e2e8f0', borderRadius: 10, marginBottom: 12 },
  findingChips: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  findingDesc: { fontSize: 14, color: '#1e293b', marginBottom: 8 },
  chip: { padding: '2px 8px', borderRadius: 999, background: '#f1f5f9', color: '#475569', fontSize: 11, fontWeight: 600 },
  photoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 },
  photoGridCompact: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 6, marginBottom: 10 },
  photoTile: { display: 'block', borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0', aspectRatio: '1 / 1', background: '#f1f5f9' },
  photoImg: { width: '100%', height: '100%', objectFit: 'cover' },
  actionGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 8 },
  actionBtn: { padding: 8, border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', cursor: 'pointer', textAlign: 'center' },
  actionBtnActive: { background: '#0f172a', color: '#fff', borderColor: '#0f172a' },
  actionLabel: { fontSize: 12, fontWeight: 700 },
  actionDesc: { fontSize: 10, marginTop: 2, opacity: 0.8 },
  amountRow: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 },
  amountLabel: { fontSize: 12, fontWeight: 600, color: '#475569', minWidth: 70 },
  input: { padding: 8, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14, flex: 1 },
  textarea: { width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' },
  actionRow: { display: 'flex', gap: 8, justifyContent: 'flex-end' },
  btnSecondary: { padding: '10px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  btnPrimary: { padding: '10px 16px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  reviewedBox: { padding: 14, borderRadius: 10, background: '#f1f5f9', color: '#334155', fontSize: 14 }
}
