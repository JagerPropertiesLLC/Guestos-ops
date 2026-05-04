'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

const STATUS_CONFIG = {
  pending:     { label: 'Pending',     bg: 'bg-gray-100',  text: 'text-gray-600',  dot: 'bg-gray-400'  },
  in_progress: { label: 'In progress', bg: 'bg-amber-50',  text: 'text-amber-700', dot: 'bg-amber-400' },
  done:        { label: 'Done',        bg: 'bg-green-50',  text: 'text-green-700', dot: 'bg-green-500' },
  issue:       { label: 'Issue',       bg: 'bg-red-50',    text: 'text-red-700',   dot: 'bg-red-500'   },
}

function formatElapsed(seconds) {
  if (seconds == null || seconds < 0) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function useElapsedSeconds(unit) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (unit.unit_status !== 'cleaning' && unit.unit_status !== 'paused') return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [unit.unit_status])
  if (!unit.started_at) return null
  // Naive client-side calc: total elapsed minus pause windows we don't have here
  // — server is source of truth on complete. Good enough for live display.
  const startedMs = new Date(unit.started_at).getTime()
  let stopMs = unit.stopped_at ? new Date(unit.stopped_at).getTime() : now
  return Math.max(0, Math.floor((stopMs - startedMs) / 1000))
}

function UnitCard({ unit, onStatusChange, onNoteAdd, onCleaningChanged }) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [startingInspection, setStartingInspection] = useState(false)
  const [cleaningBusy, setCleaningBusy] = useState(false)
  const cfg = STATUS_CONFIG[unit.status] || STATUS_CONFIG.pending
  const elapsed = useElapsedSeconds(unit)

  async function handleStartInspection() {
    setStartingInspection(true)
    try {
      const r = await fetch('/api/inspections/units', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ schedule_unit_id: unit.id })
      })
      const j = await r.json()
      if (!r.ok) {
        alert(j.error || 'Could not start inspection')
        return
      }
      router.push(`/inspections/${j.inspection.id}`)
    } finally {
      setStartingInspection(false)
    }
  }

  async function cleaningAction(action, body) {
    setCleaningBusy(true)
    try {
      const r = await fetch(`/api/cleaning/units/${unit.id}/${action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body || {})
      })
      const j = await r.json()
      if (!r.ok) { alert(j.error || `Action ${action} failed`); return }
      onCleaningChanged && onCleaningChanged()
    } finally {
      setCleaningBusy(false)
    }
  }

  async function handleStatus(newStatus) {
    setSaving(true)
    await onStatusChange(unit.id, newStatus)
    setSaving(false)
  }

  async function handleNote(e) {
    e.preventDefault()
    if (!note.trim()) return
    setSaving(true)
    await onNoteAdd(unit.id, note.trim())
    setNote('')
    setSaving(false)
  }

  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${unit.is_priority ? 'border-l-4 border-l-amber-400' : ''}`}>
      <button className="w-full text-left p-4 flex items-start gap-3" onClick={() => setExpanded(!expanded)}>
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${unit.is_priority ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-500'}`}>
          {unit.sort_order}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-gray-900 text-sm">{unit.property_name}</span>
            {unit.unit_number && <span className="text-xs text-gray-400">#{unit.unit_number}</span>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {unit.is_priority && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">⚡ Priority</span>
            )}
            {unit.no_reply && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">⚠ No reply</span>
            )}
            <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}></span>
              {cfg.label}
            </span>
          </div>
        </div>
        <svg className={`flex-shrink-0 w-4 h-4 text-gray-400 mt-1 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-50 pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-0.5">Checkout</p>
              <p className="font-semibold text-gray-800 text-sm">{unit.checkout_time || '11:00 AM'}</p>
              <p className="text-xs text-gray-400 mt-0.5">{unit.guest_name || '—'}</p>
            </div>
            {unit.early_checkin_time && (
              <div className="bg-amber-50 rounded-xl p-3">
                <p className="text-xs text-amber-600 mb-0.5">Early check-in</p>
                <p className="font-semibold text-amber-800 text-sm">{unit.early_checkin_time}</p>
                {unit.early_checkin_fee && (
                  <p className="text-xs text-amber-600 mt-0.5">${unit.early_checkin_fee} · {unit.payment_method}</p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-500">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Est. clean time: {unit.prior_stay_nights > 5 ? '2–3 hrs (long stay)' : '30 min–1.5 hrs'}
          </div>

          <div>
            <p className="text-xs text-gray-400 mb-2 font-medium">Cleaning</p>
            {(unit.unit_status === 'cleaning' || unit.unit_status === 'paused') && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 mb-2 flex items-center justify-between">
                <span className="text-xs text-blue-700">
                  {unit.unit_status === 'cleaning' ? '🟢 In progress' : '⏸ Paused'}
                  {elapsed != null && ` · ${formatElapsed(elapsed)}`}
                </span>
                {unit.cleaner?.full_name && (
                  <span className="text-xs text-blue-600">{unit.cleaner.full_name}</span>
                )}
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              {(unit.unit_status === 'idle' || !unit.unit_status) && (
                <button
                  onClick={() => cleaningAction('start')}
                  disabled={cleaningBusy}
                  className="col-span-3 py-2 px-3 rounded-xl text-xs font-semibold bg-green-600 text-white disabled:opacity-50"
                >
                  ▶ Start cleaning
                </button>
              )}
              {unit.unit_status === 'cleaning' && (
                <>
                  <button
                    onClick={() => cleaningAction('pause')}
                    disabled={cleaningBusy}
                    className="py-2 px-3 rounded-xl text-xs font-semibold bg-amber-500 text-white disabled:opacity-50"
                  >
                    ⏸ Pause
                  </button>
                  <button
                    onClick={() => cleaningAction('complete')}
                    disabled={cleaningBusy}
                    className="col-span-2 py-2 px-3 rounded-xl text-xs font-semibold bg-green-700 text-white disabled:opacity-50"
                  >
                    ✓ Complete
                  </button>
                </>
              )}
              {unit.unit_status === 'paused' && (
                <>
                  <button
                    onClick={() => cleaningAction('resume')}
                    disabled={cleaningBusy}
                    className="py-2 px-3 rounded-xl text-xs font-semibold bg-blue-600 text-white disabled:opacity-50"
                  >
                    ▶ Resume
                  </button>
                  <button
                    onClick={() => cleaningAction('complete')}
                    disabled={cleaningBusy}
                    className="col-span-2 py-2 px-3 rounded-xl text-xs font-semibold bg-green-700 text-white disabled:opacity-50"
                  >
                    ✓ Complete
                  </button>
                </>
              )}
              {unit.unit_status === 'complete' && (
                <div className="col-span-3 py-2 px-3 rounded-xl text-xs font-medium bg-green-50 text-green-700 text-center">
                  ✓ Cleaning complete
                </div>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-400 mb-2 font-medium">Manual status override</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                <button
                  key={key}
                  onClick={() => handleStatus(key)}
                  disabled={saving || unit.status === key}
                  className={`py-2 px-3 rounded-xl text-xs font-medium transition-all border
                    ${unit.status === key ? `${val.bg} ${val.text} border-transparent` : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}
                    disabled:opacity-50`}
                >
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${val.dot} mr-1.5`}></span>
                  {val.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleStartInspection}
            disabled={startingInspection}
            className="w-full py-2.5 px-3 rounded-xl text-sm font-semibold bg-blue-600 text-white disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {startingInspection ? 'Starting…' : '🔍 Start Post-Checkout Inspection'}
          </button>

          {unit.notes && unit.notes.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-gray-400 font-medium">Notes</p>
              {unit.notes.map((n, i) => (
                <div key={i} className="bg-gray-50 rounded-xl px-3 py-2 text-xs text-gray-600">
                  <span className="text-gray-400 mr-1.5">{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {n.text}
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleNote} className="flex gap-2">
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Add a note..."
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-green-400"
            />
            <button
              type="submit"
              disabled={saving || !note.trim()}
              className="px-3 py-2 bg-green-600 text-white rounded-xl text-xs font-medium disabled:opacity-40"
            >
              Add
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

export default function SchedulePage() {
  const [units, setUnits] = useState([])
  const [loading, setLoading] = useState(true)
  const [scheduleId, setScheduleId] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [filter, setFilter] = useState('all')

  const today = new Date()
  // Build dateKey from LOCAL date components, not UTC, to match the user's timezone
  const dateKey = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0')
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  const loadSchedule = useCallback(async () => {
    const { data: sched } = await supabase
      .from('cleaning_schedules')
      .select('*')
      .eq('date', dateKey)
      .single()

    if (!sched) { setLoading(false); return }
    setScheduleId(sched.id)

    const { data: unitData } = await supabase
      .from('schedule_units')
      .select('*, cleaner:cleaner_id(id, full_name, email)')
      .eq('schedule_id', sched.id)
      .order('sort_order', { ascending: true })

    setUnits(unitData || [])
    setLastUpdated(new Date())
    setLoading(false)
  }, [dateKey])

  useEffect(() => {
    loadSchedule()
    const channel = supabase
      .channel('schedule-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_units' }, loadSchedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cleaning_schedules' }, loadSchedule)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [loadSchedule])

  async function handleStatusChange(unitId, newStatus) {
    await supabase.from('schedule_units').update({
      status: newStatus,
      completed_at: newStatus === 'done' ? new Date().toISOString() : null
    }).eq('id', unitId)
    setUnits(prev => prev.map(u => u.id === unitId ? { ...u, status: newStatus } : u))
  }

  async function handleNoteAdd(unitId, text) {
    const unit = units.find(u => u.id === unitId)
    const updatedNotes = [...(unit?.notes || []), { text, created_at: new Date().toISOString() }]
    await supabase.from('schedule_units').update({ notes: updatedNotes }).eq('id', unitId)
    setUnits(prev => prev.map(u => u.id === unitId ? { ...u, notes: updatedNotes } : u))
  }

  const filtered = filter === 'all' ? units : units.filter(u => u.status === filter)
  const doneCount = units.filter(u => u.status === 'done').length
  const priorityCount = units.filter(u => u.is_priority).length
  const progress = units.length > 0 ? Math.round((doneCount / units.length) * 100) : 0

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h1 className="text-base font-bold text-gray-900">Cleaning Schedule</h1>
              <p className="text-xs text-gray-400">{dateStr}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-green-600">{doneCount}/{units.length}</p>
              <p className="text-xs text-gray-400">units done</p>
            </div>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
            <div className="bg-green-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {units.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl p-3 text-center border border-gray-100">
              <p className="text-xl font-bold text-gray-900">{units.length}</p>
              <p className="text-xs text-gray-400">Total</p>
            </div>
            <div className="bg-white rounded-2xl p-3 text-center border border-gray-100">
              <p className="text-xl font-bold text-amber-600">{priorityCount}</p>
              <p className="text-xs text-gray-400">Priority</p>
            </div>
            <div className="bg-white rounded-2xl p-3 text-center border border-gray-100">
              <p className="text-xl font-bold text-green-600">{doneCount}</p>
              <p className="text-xs text-gray-400">Done</p>
            </div>
          </div>
        )}

        {units.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[
              { key: 'all', label: 'All' },
              { key: 'pending', label: 'Pending' },
              { key: 'in_progress', label: 'In progress' },
              { key: 'done', label: 'Done' },
              { key: 'issue', label: 'Issues' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all
                  ${filter === f.key ? 'bg-green-600 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl h-20 animate-pulse border border-gray-100" />)}
          </div>
        ) : units.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
            <p className="text-3xl mb-2">🧹</p>
            <p className="font-semibold text-gray-700 mb-1">No schedule yet</p>
            <p className="text-sm text-gray-400">The schedule will appear here once GuestOS builds it at 7pm.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(unit => (
              <UnitCard
                key={unit.id}
                unit={unit}
                onStatusChange={handleStatusChange}
                onNoteAdd={handleNoteAdd}
                onCleaningChanged={loadSchedule}
              />
            ))}
          </div>
        )}

        {lastUpdated && (
          <p className="text-center text-xs text-gray-300 pb-4">
            Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · Live
          </p>
        )}
      </div>
    </div>
  )
}
