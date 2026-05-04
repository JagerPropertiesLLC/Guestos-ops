'use client'

// app/inspections/[id]/page.js
// Inspection workspace. Sam logs findings (each with photos), records an
// overall damage summary, and submits for review. Once submitted, the page
// becomes read-only for Sam; Judson sees the same view at /inspections/review.

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Camera, Trash2, Plus, CheckCircle, Edit2 } from 'lucide-react'

const SEVERITY_CONFIG = {
  minor:    { label: 'Minor',    bg: '#fef9c3', text: '#854d0e' },
  moderate: { label: 'Moderate', bg: '#fed7aa', text: '#9a3412' },
  major:    { label: 'Major',    bg: '#fecaca', text: '#991b1b' }
}
const FINDING_TYPE_CONFIG = {
  damage:         { label: 'Damage' },
  missing:        { label: 'Missing item' },
  extra_cleaning: { label: 'Extra cleaning' },
  other:          { label: 'Other' }
}
const CHARGE_CONFIG = {
  guest: { label: 'Bill guest' },
  none:  { label: 'No charge' },
  tbd:   { label: 'Decide later' }
}

export default function InspectionWorkspace() {
  const router = useRouter()
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [savingSummary, setSavingSummary] = useState(false)
  const [summaryDraft, setSummaryDraft] = useState('')
  const [showAddFinding, setShowAddFinding] = useState(false)

  const load = useCallback(async () => {
    const r = await fetch(`/api/inspections/units/${id}`)
    if (r.status === 404) { setError('Inspection not found.'); setLoading(false); return }
    const j = await r.json()
    if (!r.ok) { setError(j.error || `HTTP ${r.status}`); setLoading(false); return }
    setData(j)
    setSummaryDraft(j.inspection.damage_summary || '')
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  const isReadOnly = data?.inspection?.status && data.inspection.status !== 'in_progress'

  async function saveSummary() {
    setSavingSummary(true)
    try {
      await fetch(`/api/inspections/units/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ damage_summary: summaryDraft })
      })
    } finally {
      setSavingSummary(false)
    }
  }

  async function submitForReview() {
    if (!confirm('Submit this inspection for review? You won\'t be able to edit findings after.')) return
    setSubmitting(true)
    const r = await fetch(`/api/inspections/units/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'submitted', damage_summary: summaryDraft })
    })
    setSubmitting(false)
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      alert(j.error || 'Submit failed')
      return
    }
    router.push('/schedule')
  }

  if (loading) {
    return <main style={S.page}><BackLink /><div style={S.skel}>Loading…</div></main>
  }
  if (error) {
    return <main style={S.page}><BackLink /><div style={S.errorBox}>{error}</div></main>
  }
  const { inspection, findings, photos } = data
  const propLabel = inspection.properties?.short_name || ''
  const unitLabel = inspection.units?.unit_label || ''

  return (
    <main style={S.page}>
      <BackLink />

      <div style={S.headerCard}>
        <div style={S.headerRow}>
          <div>
            <div style={S.headerTitle}>{propLabel}{unitLabel ? ` · ${unitLabel}` : ''}</div>
            <div style={S.headerSubtitle}>
              {inspection.guest_name ? `Last guest: ${inspection.guest_name}` : 'No guest on record'}
              {inspection.checkout_date ? ` · checked out ${inspection.checkout_date}` : ''}
            </div>
          </div>
          <StatusBadge status={inspection.status} />
        </div>
      </div>

      <Section title="Findings">
        {findings.length === 0 && !showAddFinding && (
          <div style={S.emptyHint}>No findings yet. Add one for each damage, missing item, or extra cleaning need.</div>
        )}
        {findings.map(f => (
          <FindingCard
            key={f.id}
            finding={f}
            inspectionId={id}
            readOnly={isReadOnly}
            onChanged={load}
          />
        ))}
        {!isReadOnly && (
          showAddFinding ? (
            <AddFindingForm
              inspectionId={id}
              onCancel={() => setShowAddFinding(false)}
              onCreated={() => { setShowAddFinding(false); load() }}
            />
          ) : (
            <button onClick={() => setShowAddFinding(true)} style={S.addBtn}>
              <Plus size={16} /> Add finding
            </button>
          )
        )}
      </Section>

      <Section title="Overall summary">
        <textarea
          value={summaryDraft}
          onChange={e => setSummaryDraft(e.target.value)}
          onBlur={saveSummary}
          placeholder="Anything else worth noting? Smell, deep mess, condition vs prior stay…"
          disabled={isReadOnly}
          rows={3}
          style={S.textarea}
        />
        {savingSummary && <div style={S.savingHint}>Saving…</div>}
      </Section>

      <Section title="General photos">
        <PhotoGrid
          photos={photos || []}
          parentType="unit_inspection"
          parentId={id}
          readOnly={isReadOnly}
          onChanged={load}
        />
      </Section>

      {!isReadOnly && (
        <button onClick={submitForReview} disabled={submitting} style={S.submitBtn}>
          {submitting ? 'Submitting…' : 'Submit for review'}
        </button>
      )}

      {isReadOnly && (
        <div style={S.reviewBox}>
          {inspection.status === 'submitted' && 'Submitted — waiting on Judson\'s review.'}
          {inspection.status === 'reviewed' && 'Reviewed by Judson.'}
          {inspection.status === 'closed' && 'Closed.'}
          {inspection.review_notes && (
            <div style={S.reviewNotes}>
              <strong>Review notes:</strong> {inspection.review_notes}
            </div>
          )}
        </div>
      )}
    </main>
  )
}

function StatusBadge({ status }) {
  const map = {
    in_progress: { label: 'In progress', bg: '#fef3c7', text: '#92400e' },
    submitted:   { label: 'Submitted',   bg: '#dbeafe', text: '#1e40af' },
    reviewed:    { label: 'Reviewed',    bg: '#dcfce7', text: '#166534' },
    closed:      { label: 'Closed',      bg: '#f3f4f6', text: '#374151' }
  }
  const cfg = map[status] || map.in_progress
  return (
    <span style={{ ...S.badge, background: cfg.bg, color: cfg.text }}>{cfg.label}</span>
  )
}

function Section({ title, children }) {
  return (
    <section style={S.section}>
      <div style={S.sectionTitle}>{title}</div>
      {children}
    </section>
  )
}

function BackLink() {
  return (
    <Link href="/schedule" style={S.back}>
      <ChevronLeft size={16} /> <span>Back to schedule</span>
    </Link>
  )
}

function FindingCard({ finding, inspectionId, readOnly, onChanged }) {
  const [editing, setEditing] = useState(false)
  const sev = SEVERITY_CONFIG[finding.severity] || SEVERITY_CONFIG.minor
  const ftype = FINDING_TYPE_CONFIG[finding.finding_type] || FINDING_TYPE_CONFIG.other
  const charge = CHARGE_CONFIG[finding.charge_to] || CHARGE_CONFIG.tbd

  async function remove() {
    if (!confirm('Delete this finding?')) return
    await fetch(`/api/inspections/findings/${finding.id}`, { method: 'DELETE' })
    onChanged()
  }

  if (editing) {
    return (
      <EditFindingForm
        finding={finding}
        onCancel={() => setEditing(false)}
        onSaved={() => { setEditing(false); onChanged() }}
      />
    )
  }

  return (
    <div style={S.findingCard}>
      <div style={S.findingHeader}>
        <div style={S.findingChips}>
          <span style={S.chip}>{ftype.label}</span>
          <span style={{ ...S.chip, background: sev.bg, color: sev.text }}>{sev.label}</span>
          <span style={S.chip}>{charge.label}</span>
          {finding.claim_eligible && <span style={{ ...S.chip, background: '#e0e7ff', color: '#3730a3' }}>Insurance</span>}
        </div>
        {!readOnly && (
          <div style={S.findingActions}>
            <button onClick={() => setEditing(true)} style={S.iconBtn}><Edit2 size={14} /></button>
            <button onClick={remove} style={S.iconBtn}><Trash2 size={14} /></button>
          </div>
        )}
      </div>
      <div style={S.findingDesc}>{finding.description}</div>
      {finding.estimated_cost_cents != null && (
        <div style={S.findingCost}>Est. ${(Number(finding.estimated_cost_cents) / 100).toFixed(2)}</div>
      )}
      <PhotoGrid
        photos={finding.photos || []}
        parentType="inspection_finding"
        parentId={finding.id}
        readOnly={readOnly}
        onChanged={onChanged}
        compact
      />
    </div>
  )
}

function AddFindingForm({ inspectionId, onCancel, onCreated }) {
  const [description, setDescription] = useState('')
  const [findingType, setFindingType] = useState('damage')
  const [severity, setSeverity] = useState('minor')
  const [chargeTo, setChargeTo] = useState('tbd')
  const [claim, setClaim] = useState(false)
  const [estDollars, setEstDollars] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!description.trim()) { alert('Description is required'); return }
    setSaving(true)
    const cents = estDollars ? Math.round(parseFloat(estDollars) * 100) : null
    const r = await fetch('/api/inspections/findings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        inspection_id: inspectionId,
        description: description.trim(),
        finding_type: findingType,
        severity,
        charge_to: chargeTo,
        claim_eligible: claim,
        estimated_cost_cents: cents
      })
    })
    setSaving(false)
    if (!r.ok) { const j = await r.json().catch(() => ({})); alert(j.error || 'Save failed'); return }
    onCreated()
  }

  return (
    <div style={S.findingCard}>
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="What did you find? (e.g., 'Coffee stain on living room rug, ~12 inches')"
        rows={2}
        style={S.textarea}
      />
      <div style={S.formRow}>
        <select value={findingType} onChange={e => setFindingType(e.target.value)} style={S.select}>
          {Object.entries(FINDING_TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={severity} onChange={e => setSeverity(e.target.value)} style={S.select}>
          {Object.entries(SEVERITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
      <div style={S.formRow}>
        <select value={chargeTo} onChange={e => setChargeTo(e.target.value)} style={S.select}>
          {Object.entries(CHARGE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <input
          type="number" inputMode="decimal" placeholder="Est. $"
          value={estDollars} onChange={e => setEstDollars(e.target.value)}
          style={S.input}
        />
      </div>
      <label style={S.checkboxRow}>
        <input type="checkbox" checked={claim} onChange={e => setClaim(e.target.checked)} />
        Insurance claim eligible
      </label>
      <div style={S.formButtons}>
        <button onClick={onCancel} style={S.btnGhost}>Cancel</button>
        <button onClick={save} disabled={saving} style={S.btnPrimary}>{saving ? 'Saving…' : 'Add'}</button>
      </div>
    </div>
  )
}

function EditFindingForm({ finding, onCancel, onSaved }) {
  const [description, setDescription] = useState(finding.description || '')
  const [findingType, setFindingType] = useState(finding.finding_type)
  const [severity, setSeverity] = useState(finding.severity)
  const [chargeTo, setChargeTo] = useState(finding.charge_to)
  const [claim, setClaim] = useState(!!finding.claim_eligible)
  const [estDollars, setEstDollars] = useState(
    finding.estimated_cost_cents != null ? (Number(finding.estimated_cost_cents) / 100).toString() : ''
  )
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const cents = estDollars ? Math.round(parseFloat(estDollars) * 100) : null
    const r = await fetch(`/api/inspections/findings/${finding.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        description, finding_type: findingType, severity,
        charge_to: chargeTo, claim_eligible: claim, estimated_cost_cents: cents
      })
    })
    setSaving(false)
    if (!r.ok) { const j = await r.json().catch(() => ({})); alert(j.error || 'Save failed'); return }
    onSaved()
  }

  return (
    <div style={S.findingCard}>
      <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} style={S.textarea} />
      <div style={S.formRow}>
        <select value={findingType} onChange={e => setFindingType(e.target.value)} style={S.select}>
          {Object.entries(FINDING_TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={severity} onChange={e => setSeverity(e.target.value)} style={S.select}>
          {Object.entries(SEVERITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
      <div style={S.formRow}>
        <select value={chargeTo} onChange={e => setChargeTo(e.target.value)} style={S.select}>
          {Object.entries(CHARGE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <input type="number" inputMode="decimal" placeholder="Est. $" value={estDollars} onChange={e => setEstDollars(e.target.value)} style={S.input} />
      </div>
      <label style={S.checkboxRow}>
        <input type="checkbox" checked={claim} onChange={e => setClaim(e.target.checked)} />
        Insurance claim eligible
      </label>
      <div style={S.formButtons}>
        <button onClick={onCancel} style={S.btnGhost}>Cancel</button>
        <button onClick={save} disabled={saving} style={S.btnPrimary}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </div>
  )
}

function PhotoGrid({ photos, parentType, parentId, readOnly, onChanged, compact }) {
  const fileInputRef = useRef(null)
  const [uploading, setUploading] = useState(false)

  async function onPick(e) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setUploading(true)
    try {
      for (const file of files) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('parent_type', parentType)
        fd.append('parent_id', parentId)
        fd.append('section', 'inspections')
        await fetch('/api/documents', { method: 'POST', body: fd })
      }
      e.target.value = ''
      onChanged()
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      {photos.length > 0 && (
        <div style={compact ? S.photoGridCompact : S.photoGrid}>
          {photos.map(p => (
            <a key={p.id} href={p.download_url} target="_blank" rel="noreferrer" style={S.photoTile}>
              {p.mime_type?.startsWith('image/')
                ? <img src={p.download_url} alt={p.title} style={S.photoImg} />
                : <span style={S.photoFallback}>📎 {p.title}</span>}
            </a>
          ))}
        </div>
      )}
      {!readOnly && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={onPick}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={compact ? S.photoBtnCompact : S.photoBtn}
          >
            <Camera size={14} /> {uploading ? 'Uploading…' : 'Add photo'}
          </button>
        </>
      )}
    </div>
  )
}

const S = {
  page: { maxWidth: 720, margin: '0 auto', padding: '20px 16px 80px', fontFamily: 'system-ui, -apple-system, sans-serif' },
  back: { display: 'inline-flex', alignItems: 'center', gap: 4, color: '#475569', fontSize: 13, textDecoration: 'none', marginBottom: 12 },
  skel: { padding: 40, textAlign: 'center', color: '#94a3b8' },
  errorBox: { padding: 16, background: '#fef2f2', color: '#991b1b', borderRadius: 8, fontSize: 14 },
  headerCard: { background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e2e8f0', marginBottom: 12 },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  headerTitle: { fontSize: 18, fontWeight: 700, color: '#0f172a' },
  headerSubtitle: { fontSize: 13, color: '#64748b', marginTop: 4 },
  badge: { padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' },
  section: { background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e2e8f0', marginBottom: 12 },
  sectionTitle: { fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  emptyHint: { fontSize: 13, color: '#94a3b8', padding: '12px 0' },
  findingCard: { border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, marginBottom: 10 },
  findingHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  findingChips: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  findingActions: { display: 'flex', gap: 4 },
  findingDesc: { fontSize: 14, color: '#1e293b', marginBottom: 6 },
  findingCost: { fontSize: 12, color: '#64748b', marginBottom: 8 },
  chip: { padding: '2px 8px', borderRadius: 999, background: '#f1f5f9', color: '#475569', fontSize: 11, fontWeight: 600 },
  iconBtn: { background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 },
  addBtn: { width: '100%', padding: 10, borderRadius: 10, border: '1px dashed #cbd5e1', background: '#fff', color: '#475569', fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer' },
  textarea: { width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' },
  input: { padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, width: '100%', boxSizing: 'border-box' },
  select: { padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, background: '#fff', width: '100%', boxSizing: 'border-box' },
  formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 },
  checkboxRow: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#475569', marginTop: 8 },
  formButtons: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  btnGhost: { padding: '8px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  btnPrimary: { padding: '8px 16px', borderRadius: 8, border: 'none', background: '#0f172a', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  savingHint: { fontSize: 11, color: '#94a3b8', marginTop: 4 },
  submitBtn: { width: '100%', padding: 14, borderRadius: 10, border: 'none', background: '#16a34a', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 8 },
  reviewBox: { padding: 14, borderRadius: 10, background: '#f1f5f9', color: '#334155', fontSize: 14, marginTop: 8 },
  reviewNotes: { marginTop: 8, padding: 8, background: '#fff', borderRadius: 6, fontSize: 13 },
  photoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8, marginBottom: 8 },
  photoGridCompact: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 6, marginBottom: 6 },
  photoTile: { display: 'block', borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0', aspectRatio: '1 / 1', background: '#f1f5f9' },
  photoImg: { width: '100%', height: '100%', objectFit: 'cover' },
  photoFallback: { padding: 6, fontSize: 11, color: '#64748b' },
  photoBtn: { width: '100%', padding: 10, borderRadius: 10, border: '1px dashed #cbd5e1', background: '#fff', color: '#475569', fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer' },
  photoBtnCompact: { width: '100%', padding: 8, borderRadius: 8, border: '1px dashed #cbd5e1', background: '#fff', color: '#475569', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer' }
}
