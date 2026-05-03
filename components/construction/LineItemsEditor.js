'use client';

// components/construction/LineItemsEditor.js
// AIA G702/G703 schedule of values. Inline edit-on-blur per row.
//
// Field-name asymmetry: the DB column for the line-item dollar amount is
// `contract_amount`. The UI label says "Scheduled value" per AIA convention.
// All API payloads use `contract_amount`.

import { useEffect, useState } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { tokens } from './_tokens';

export default function LineItemsEditor({
  projectId, subcontractId, retainagePctDefault,
  lineItems, onChanged,
}) {
  const [items, setItems]     = useState(lineItems || []);
  const [adding, setAdding]   = useState(false);
  const [error, setError]     = useState(null);

  useEffect(() => { setItems(lineItems || []); }, [lineItems]);

  async function addLine() {
    setAdding(true);
    setError(null);
    try {
      const r = await fetch(`/api/construction/projects/${projectId}/subcontracts/${subcontractId}/line-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'New line item', contract_amount: 0 }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(humanizeError(j.error) || `HTTP ${r.status}`);
      onChanged?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setAdding(false);
    }
  }

  async function patch(id, partial) {
    setError(null);
    try {
      const r = await fetch(`/api/construction/projects/${projectId}/subcontracts/${subcontractId}/line-items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(humanizeError(j.error) || `HTTP ${r.status}`);
      onChanged?.();
    } catch (e) {
      setError(e.message);
      onChanged?.(); // re-fetch to revert optimistic UI
    }
  }

  async function remove(id) {
    if (!confirm('Delete this line item?')) return;
    setError(null);
    try {
      const r = await fetch(`/api/construction/projects/${projectId}/subcontracts/${subcontractId}/line-items/${id}`, { method: 'DELETE' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(humanizeError(j.error) || `HTTP ${r.status}`);
      onChanged?.();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      {error && <div style={s.error}>{error}</div>}

      {items.length === 0 ? (
        <div style={s.empty}>
          <div style={{ marginBottom: 12 }}>No line items yet. Add the first one to start the schedule of values.</div>
          <button onClick={addLine} disabled={adding} style={s.addBtnPrimary}>
            {adding ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={12} />}
            <span>Add line item</span>
          </button>
        </div>
      ) : (
        <>
          <div style={s.tableWrap}>
            <div style={s.tableHead}>
              <div style={{ flex: 2 }}>Description</div>
              <div style={{ width: 130, textAlign: 'right' }}>Scheduled value</div>
              <div style={{ width: 130, textAlign: 'right' }}>Paid to date</div>
              <div style={{ width: 110, textAlign: 'right' }}>Retainage</div>
              <div style={{ width: 80,  textAlign: 'right' }}>% Done</div>
              <div style={{ width: 130, textAlign: 'right' }}>Remaining</div>
              <div style={{ width: 40 }} />
            </div>
            {items.map(line => (
              <LineRow
                key={line.id}
                line={line}
                retainagePctDefault={retainagePctDefault}
                onPatch={(partial) => patch(line.id, partial)}
                onDelete={() => remove(line.id)}
              />
            ))}
          </div>

          <div style={{ marginTop: 12 }}>
            <button onClick={addLine} disabled={adding} style={s.addBtn}>
              {adding ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={12} />}
              <span>Add line item</span>
            </button>
          </div>
        </>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function LineRow({ line, retainagePctDefault, onPatch, onDelete }) {
  const [description,   setDescription]   = useState(line.description || '');
  const [contractAmt,   setContractAmt]   = useState(line.contract_amount ?? 0);
  const [paidToDate,    setPaidToDate]    = useState(line.paid_to_date ?? 0);
  const [retainageHeld, setRetainageHeld] = useState(line.retainage_held ?? 0);
  const [pctComplete,   setPctComplete]   = useState(line.pct_complete ?? 0);

  useEffect(() => { setDescription(line.description || ''); },           [line.description]);
  useEffect(() => { setContractAmt(line.contract_amount ?? 0); },        [line.contract_amount]);
  useEffect(() => { setPaidToDate(line.paid_to_date ?? 0); },            [line.paid_to_date]);
  useEffect(() => { setRetainageHeld(line.retainage_held ?? 0); },       [line.retainage_held]);
  useEffect(() => { setPctComplete(line.pct_complete ?? 0); },           [line.pct_complete]);

  // When paid changes, suggest retainage based on the subcontract's retainage_pct.
  // Only auto-fills if the user hasn't manually set a value (retainage_held == 0).
  function onPaidBlur() {
    if (Number(paidToDate) === Number(line.paid_to_date)) return;
    const partial = { paid_to_date: Number(paidToDate) };
    if (retainagePctDefault != null && Number(line.retainage_held || 0) === 0) {
      const suggested = Math.round(Number(paidToDate) * Number(retainagePctDefault) / 100 * 100) / 100;
      partial.retainage_held = suggested;
      setRetainageHeld(suggested);
    }
    onPatch(partial);
  }

  const remaining = Number(contractAmt || 0) - Number(paidToDate || 0);

  return (
    <div style={s.row}>
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={() => description !== line.description && onPatch({ description })}
        style={{ ...s.input, flex: 2 }}
      />
      <input
        type="number" step="any" min="0"
        value={contractAmt}
        onChange={(e) => setContractAmt(e.target.value)}
        onBlur={() => Number(contractAmt) !== Number(line.contract_amount) && onPatch({ contract_amount: Number(contractAmt) })}
        style={{ ...s.input, width: 130, textAlign: 'right' }}
      />
      <input
        type="number" step="any" min="0"
        value={paidToDate}
        onChange={(e) => setPaidToDate(e.target.value)}
        onBlur={onPaidBlur}
        style={{ ...s.input, width: 130, textAlign: 'right' }}
      />
      <input
        type="number" step="any" min="0"
        value={retainageHeld}
        onChange={(e) => setRetainageHeld(e.target.value)}
        onBlur={() => Number(retainageHeld) !== Number(line.retainage_held) && onPatch({ retainage_held: Number(retainageHeld) })}
        style={{ ...s.input, width: 110, textAlign: 'right' }}
      />
      <input
        type="number" step="any" min="0" max="100"
        value={pctComplete}
        onChange={(e) => setPctComplete(e.target.value)}
        onBlur={() => Number(pctComplete) !== Number(line.pct_complete) && onPatch({ pct_complete: Number(pctComplete) })}
        style={{ ...s.input, width: 80, textAlign: 'right' }}
      />
      <div style={{ width: 130, textAlign: 'right', fontSize: 13, padding: '6px 8px', color: remaining < 0 ? tokens.errorText : tokens.textPrimary }}>
        {fmt(remaining)}
      </div>
      <div style={{ width: 40, textAlign: 'right' }}>
        <button onClick={onDelete} style={s.iconBtn} title="Delete line item">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function humanizeError(code) {
  switch (code) {
    case 'paid_exceeds_scheduled': return 'Paid to date cannot exceed the scheduled value.';
    case 'invalid_pct_complete':   return '% complete must be between 0 and 100.';
    case 'invalid_contract_amount':return 'Scheduled value must be a non-negative number.';
    case 'invalid_paid_to_date':   return 'Paid to date must be a non-negative number.';
    case 'invalid_retainage_held': return 'Retainage held must be a non-negative number.';
    case 'description_required':   return 'Description is required.';
    default: return code;
  }
}

function fmt(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const s = {
  empty: { padding: 24, textAlign: 'center', color: tokens.textTertiary, fontSize: 13 },
  error: { background: tokens.errorBg, color: tokens.errorText, padding: 8, borderRadius: 6, fontSize: 13, marginBottom: 8 },
  tableWrap: { display: 'flex', flexDirection: 'column', gap: 4 },
  tableHead: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '4px 0', fontSize: 11, fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: 0.4,
    color: tokens.textTertiary,
    borderBottom: `1px solid ${tokens.border}`, marginBottom: 4,
  },
  row: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' },
  input: {
    padding: '6px 8px',
    border: `1px solid ${tokens.border}`, borderRadius: 4,
    fontSize: 13, background: tokens.surface, color: tokens.textPrimary,
    fontFamily: 'inherit',
  },
  iconBtn: {
    background: 'transparent', border: 0, padding: 2, cursor: 'pointer',
    color: tokens.errorText, display: 'inline-flex',
  },
  addBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    background: tokens.primary, color: '#fff', border: 0,
    padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer',
  },
  addBtnPrimary: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: tokens.primary, color: '#fff', border: 0,
    padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer',
  },
};
