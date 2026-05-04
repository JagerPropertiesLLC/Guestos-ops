// components/field-log/QuickTagOverlay.js
// Slides up after a photo capture (or in inbox). Lets the user set unit/type/note.
'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';

export default function QuickTagOverlay({
  target,            // { kind: 'property'|'project', id, name }
  units = [],        // for property targets: [{ id, unit_label }]
  initial = {},      // existing tags (unit_id, photo_type, note)
  onSubmit,          // (tags) => void   -- called on Save & Next OR Skip
  onChangeTarget,    // () => void
  onClose,           // () => void
  saveLabel = 'Save'
}) {
  const [unitId, setUnitId]    = useState(initial.unit_id || null);
  const [photoType, setType]   = useState(initial.photo_type || null);
  const [note, setNote]        = useState(initial.note || '');
  const [showNote, setShowNote] = useState(!!initial.note);

  useEffect(() => {
    setUnitId(initial.unit_id || null);
    setType(initial.photo_type || null);
    setNote(initial.note || '');
  }, [initial.unit_id, initial.photo_type, initial.note]);

  function save(skip = false) {
    onSubmit({
      property_id: target?.kind === 'property' ? target.id : null,
      project_id:  target?.kind === 'project'  ? target.id : null,
      unit_id: unitId,
      photo_type: photoType,
      note: note || null,
      _skip: skip
    });
  }

  return (
    <div style={overlay}>
      <div style={card}>
        <div style={header}>
          <div>
            <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6 }}>{target?.kind || 'No target'}</div>
            <div style={{ fontSize: 17, fontWeight: 600 }}>{target?.name || 'Pick a target'}</div>
          </div>
          {onChangeTarget && (
            <button onClick={onChangeTarget} style={changeBtn}>change</button>
          )}
          {onClose && (
            <button onClick={onClose} style={iconBtn}><X size={18} /></button>
          )}
        </div>

        {target?.kind === 'property' && units.length > 1 && (
          <div style={{ marginTop: 14 }}>
            <Label>Unit</Label>
            <ChipRow>
              {units.map(u => (
                <Chip key={u.id} active={unitId === u.id} onClick={() => setUnitId(unitId === u.id ? null : u.id)}>
                  {u.unit_label}
                </Chip>
              ))}
            </ChipRow>
          </div>
        )}

        <div style={{ marginTop: 14 }}>
          <Label>Type</Label>
          <ChipRow>
            <Chip active={photoType === 'issue'}     onClick={() => setType(photoType === 'issue'     ? null : 'issue')}     tone="red">Issue</Chip>
            <Chip active={photoType === 'progress'}  onClick={() => setType(photoType === 'progress'  ? null : 'progress')}  tone="blue">Progress</Chip>
            <Chip active={photoType === 'reference'} onClick={() => setType(photoType === 'reference' ? null : 'reference')}>Reference</Chip>
          </ChipRow>
        </div>

        <div style={{ marginTop: 14 }}>
          {showNote ? (
            <>
              <Label>Note</Label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
                placeholder={photoType === 'issue' ? 'Describe the issue (will be cleaned up by AI)' : 'Optional note'}
                style={textarea} />
            </>
          ) : (
            <button onClick={() => setShowNote(true)} style={addNoteBtn}>+ Add note</button>
          )}
        </div>

        <div style={footer}>
          <button onClick={() => save(true)} style={btnSecondary}>Skip</button>
          <button onClick={() => save(false)} style={btnPrimary}>{saveLabel}</button>
        </div>
      </div>
    </div>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 12, color: '#475569', fontWeight: 500, marginBottom: 6 }}>{children}</div>;
}

function ChipRow({ children }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{children}</div>;
}

function Chip({ children, active, tone, onClick }) {
  const tones = {
    red:  { bg: '#fee2e2', fg: '#b91c1c', activeBg: '#dc2626', activeFg: '#fff' },
    blue: { bg: '#dbeafe', fg: '#1e40af', activeBg: '#1d4ed8', activeFg: '#fff' },
    default: { bg: '#f1f5f9', fg: '#475569', activeBg: '#0f172a', activeFg: '#fff' }
  };
  const t = tones[tone] || tones.default;
  return (
    <button onClick={onClick} style={{
      padding: '8px 14px', borderRadius: 999, fontSize: 14, fontWeight: 500, cursor: 'pointer',
      border: 0, background: active ? t.activeBg : t.bg, color: active ? t.activeFg : t.fg
    }}>{children}</button>
  );
}

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 100,
  display: 'flex', alignItems: 'flex-end', justifyContent: 'center'
};
const card = {
  background: '#fff', borderRadius: '14px 14px 0 0', width: '100%', maxWidth: 600,
  padding: '20px 20px 16px', maxHeight: '88vh', overflowY: 'auto',
  boxShadow: '0 -4px 24px rgba(15,23,42,0.18)'
};
const header = { display: 'flex', alignItems: 'center', gap: 10 };
const changeBtn = { fontSize: 12, color: '#0f172a', background: 'transparent', border: '1px solid #cbd5e1', borderRadius: 5, padding: '4px 10px', cursor: 'pointer', textDecoration: 'underline' };
const iconBtn = { background: 'transparent', border: 0, cursor: 'pointer', color: '#64748b' };
const textarea = { width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit' };
const addNoteBtn = { background: 'transparent', border: 0, color: '#0f172a', fontSize: 13, cursor: 'pointer', padding: 0, textDecoration: 'underline' };
const footer = { display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' };
const btnPrimary   = { background: '#0f172a', color: '#fff', border: 0, padding: '10px 18px', borderRadius: 7, cursor: 'pointer', fontSize: 14, fontWeight: 500 };
const btnSecondary = { background: '#fff', color: '#475569', border: '1px solid #cbd5e1', padding: '10px 16px', borderRadius: 7, cursor: 'pointer', fontSize: 14 };
