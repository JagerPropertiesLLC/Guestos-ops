// components/construction/ProjectFilesSection.js
// Documents attached to a construction project. Reuses AllFilesTab from the
// property detail components.
'use client';

import { useState } from 'react';
import { FolderOpen, ChevronDown, ChevronRight } from 'lucide-react';
import AllFilesTab from '@/components/property/AllFilesTab';
import { tokens } from './_tokens';

export default function ProjectFilesSection({ projectId }) {
  const [open, setOpen] = useState(true);
  return (
    <section style={s.card}>
      <div style={s.head} onClick={() => setOpen(o => !o)}>
        {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        <FolderOpen size={18} style={{ color: tokens.primary }} />
        <h2 style={s.title}>Documents</h2>
        <span style={s.subtitle}>Plans, permits, contracts — anything not pinned to a sub or draw</span>
      </div>
      {open && (
        <div style={s.body}>
          <AllFilesTab parentType="project" parentId={projectId} />
        </div>
      )}
    </section>
  );
}

const s = {
  card: { background: tokens.surface, border: `1px solid ${tokens.border}`, borderRadius: 10, marginBottom: 16, overflow: 'hidden' },
  head: { display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', cursor: 'pointer' },
  title: { fontSize: 15, fontWeight: 600, margin: 0, color: tokens.textPrimary },
  subtitle: { fontSize: 12, color: tokens.textTertiary, marginLeft: 8 },
  body: { padding: '0 18px 18px', borderTop: `1px solid ${tokens.border}` }
};
