// components/property/RequiredDocsTab.js
// Required-docs checklist. Sections collapsed by default unless they have
// missing items. Each slot shows status icon + actions.
'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, Circle, MinusCircle, Download, Trash2, Upload } from 'lucide-react';
import UploadDocumentModal from '../UploadDocumentModal';

const SECTION_LABELS = {
  '1-llc-entity': '1. LLC / Entity',
  '2-acquisition-closing': '2. Acquisition & Closing',
  '3-finance-accounting': '3. Finance & Accounting',
  '4-title-tax-insurance': '4. Title, Tax & Insurance',
  'misc': 'Other'
};

const SUBSECTION_LABELS = {
  'formation-docs': 'Formation Docs',
  'operating-agreement': 'Operating Agreement',
  'deed-ownership': 'Deed & Ownership',
  'licenses-permits': 'Licenses & Permits',
  'annual-compliance': 'Annual Compliance',
  'title': 'Title',
  'property-tax': 'Property Tax',
  'insurance': 'Insurance',
  '_': null
};

export default function RequiredDocsTab({ propertyId, parentType, parentId, reqDocs, onChange }) {
  const _parentType = parentType || 'property';
  const _parentId   = parentId   || propertyId;
  const [uploadFor, setUploadFor] = useState(null); // slot to upload for
  const [openSections, setOpenSections] = useState(() => {
    // Open sections with any missing items by default
    const open = {};
    for (const [sec, subs] of Object.entries(reqDocs.grouped)) {
      const slots = Object.values(subs).flat();
      if (slots.some(s => s.status === 'required')) open[sec] = true;
    }
    return open;
  });

  const sectionKeys = Object.keys(reqDocs.grouped).sort();

  if (sectionKeys.length === 0) {
    return <p style={{ color: '#64748b' }}>No required documents configured.</p>;
  }

  return (
    <div>
      {sectionKeys.map(sec => {
        const subs = reqDocs.grouped[sec];
        const slots = Object.values(subs).flat();
        const missing = slots.filter(s => s.status === 'required').length;
        const fulfilled = slots.filter(s => s.status === 'fulfilled').length;
        const open = openSections[sec] ?? false;

        return (
          <div key={sec} style={sectionCard}>
            <div onClick={() => setOpenSections(o => ({ ...o, [sec]: !open }))} style={sectionHead}>
              {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <span style={{ fontWeight: 600 }}>{SECTION_LABELS[sec] || sec}</span>
              <span style={sectionCount}>{fulfilled} of {fulfilled + missing}</span>
            </div>
            {open && (
              <div style={{ padding: '0 16px 12px' }}>
                {Object.entries(subs).map(([sub, subSlots]) => (
                  <div key={sub} style={{ marginTop: 12 }}>
                    {SUBSECTION_LABELS[sub] && (
                      <div style={subHead}>{SUBSECTION_LABELS[sub]}</div>
                    )}
                    {subSlots.map(slot => (
                      <SlotRow
                        key={slot.id}
                        slot={slot}
                        onUpload={() => setUploadFor(slot)}
                        onChange={onChange}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {uploadFor && (
        <UploadDocumentModal
          parentType={_parentType}
          parentId={_parentId}
          fulfillsSlotId={uploadFor.id}
          defaultTitle={uploadFor.template?.title || ''}
          defaultSection={uploadFor.template?.section}
          defaultSubsection={uploadFor.template?.subsection}
          onClose={() => setUploadFor(null)}
          onUploaded={() => { setUploadFor(null); onChange(); }}
        />
      )}
    </div>
  );
}

function SlotRow({ slot, onUpload, onChange }) {
  const [busy, setBusy] = useState(false);

  async function markNa() {
    const reason = prompt('Reason for marking N/A (optional):');
    if (reason === null) return; // cancelled
    setBusy(true);
    await fetch(`/api/required-doc-slots/${slot.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'not_applicable', reason })
    });
    setBusy(false);
    onChange();
  }

  async function unmarkNa() {
    setBusy(true);
    await fetch(`/api/required-doc-slots/${slot.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'required' })
    });
    setBusy(false);
    onChange();
  }

  async function deleteDoc() {
    if (!slot.document) return;
    if (!confirm(`Delete "${slot.document.title}"? Slot will return to required.`)) return;
    setBusy(true);
    await fetch(`/api/documents/${slot.document.id}`, { method: 'DELETE' });
    setBusy(false);
    onChange();
  }

  const Icon = slot.status === 'fulfilled' ? CheckCircle2
             : slot.status === 'not_applicable' ? MinusCircle
             : Circle;
  const iconColor = slot.status === 'fulfilled' ? '#16a34a'
                  : slot.status === 'not_applicable' ? '#94a3b8'
                  : '#dc2626';

  return (
    <div style={slotRow}>
      <Icon size={16} style={{ color: iconColor, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14 }}>{slot.template?.title}</div>
        {slot.status === 'fulfilled' && slot.document && (
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            {slot.document.title}
          </div>
        )}
        {slot.status === 'not_applicable' && slot.marked_na_reason && (
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, fontStyle: 'italic' }}>
            N/A — {slot.marked_na_reason}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {slot.status === 'required' && (
          <>
            <button onClick={onUpload} disabled={busy} style={smallBtnPrimary}>
              <Upload size={12} /> Upload
            </button>
            <button onClick={markNa} disabled={busy} style={smallBtnLink}>Mark N/A</button>
          </>
        )}
        {slot.status === 'fulfilled' && (
          <>
            <button onClick={deleteDoc} disabled={busy} style={smallBtnIcon} title="Delete and reset">
              <Trash2 size={13} />
            </button>
          </>
        )}
        {slot.status === 'not_applicable' && (
          <button onClick={unmarkNa} disabled={busy} style={smallBtnLink}>Restore</button>
        )}
      </div>
    </div>
  );
}

const sectionCard = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 8 };
const sectionHead = { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', cursor: 'pointer' };
const sectionCount = { marginLeft: 'auto', fontSize: 12, color: '#64748b' };
const subHead = { fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 };
const slotRow = { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid #f1f5f9' };
const smallBtnPrimary = { display: 'inline-flex', alignItems: 'center', gap: 4, background: '#0f172a', color: '#fff', border: 0, padding: '5px 10px', borderRadius: 5, cursor: 'pointer', fontSize: 12 };
const smallBtnLink = { background: 'transparent', color: '#64748b', border: 0, padding: '5px 8px', cursor: 'pointer', fontSize: 12, textDecoration: 'underline' };
const smallBtnIcon = { background: 'transparent', color: '#64748b', border: '1px solid #e2e8f0', padding: 5, borderRadius: 5, cursor: 'pointer', display: 'inline-flex' };
