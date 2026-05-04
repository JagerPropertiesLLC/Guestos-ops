// components/construction/ProjectPhotosSection.js
// Site visit photos for a construction project — reuses SiteVisitsTab.
'use client';

import { useState } from 'react';
import { Camera, ChevronDown, ChevronRight } from 'lucide-react';
import SiteVisitsTab from '@/components/property/SiteVisitsTab';
import { tokens } from './_tokens';

export default function ProjectPhotosSection({ projectId, project }) {
  const [open, setOpen] = useState(true);
  return (
    <section style={s.card}>
      <div style={s.head} onClick={() => setOpen(o => !o)}>
        {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        <Camera size={18} style={{ color: tokens.primary }} />
        <h2 style={s.title}>Photos</h2>
        <span style={s.subtitle}>Progress + reference photos routed from the field log</span>
      </div>
      {open && (
        <div style={s.body}>
          <SiteVisitsTab projectId={projectId} project={project} />
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
