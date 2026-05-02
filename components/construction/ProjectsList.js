'use client';

// components/construction/ProjectsList.js
// Grid of project cards on /construction.

import { tokens } from './_tokens';
import ProjectCard from './ProjectCard';

export default function ProjectsList({ projects, loading, error, onRetry }) {
  if (error) {
    return (
      <div style={s.errBanner}>
        <span>Error loading projects: {error}</span>
        <button onClick={onRetry} style={s.retry}>Retry</button>
      </div>
    );
  }
  if (loading) {
    return (
      <div style={s.grid}>
        {[1, 2, 3].map(i => <div key={i} style={s.skel} />)}
      </div>
    );
  }
  if (!projects || projects.length === 0) {
    return (
      <div style={s.empty}>
        No projects yet. Click <strong>+ New project</strong> to create your first one.
      </div>
    );
  }

  return (
    <div style={s.grid}>
      {projects.map(p => <ProjectCard key={p.id} project={p} />)}
    </div>
  );
}

const s = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: 14,
  },
  skel: {
    height: 240,
    background: tokens.surfaceMuted,
    border: `1px solid ${tokens.border}`,
    borderRadius: 10,
  },
  empty: {
    padding: 60,
    textAlign: 'center',
    background: tokens.surface,
    border: `1px dashed ${tokens.border}`,
    borderRadius: 10,
    color: tokens.textSecondary,
    fontSize: 14,
  },
  errBanner: {
    padding: 12,
    background: tokens.errorBg,
    color: tokens.errorText,
    borderRadius: 8,
    fontSize: 14,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  retry: {
    background: tokens.errorText,
    color: '#fff',
    border: 0,
    padding: '4px 10px',
    borderRadius: 4,
    fontSize: 12,
    cursor: 'pointer',
  },
};
