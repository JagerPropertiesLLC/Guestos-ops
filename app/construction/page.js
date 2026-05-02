'use client';

// app/construction/page.js
// Construction landing — list of projects + new-project modal.

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { tokens } from '@/components/construction/_tokens';
import ProjectsList from '@/components/construction/ProjectsList';
import NewProjectModal from '@/components/construction/NewProjectModal';

export default function ConstructionLandingPage() {
  const router = useRouter();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/construction/projects');
      if (r.status === 403) {
        setTimeout(() => router.push('/'), 200);
        return;
      }
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setProjects(j.projects || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  async function handleCreated(project) {
    setShowModal(false);
    if (project?.id) {
      router.push(`/construction/${project.id}`);
    } else {
      await fetchProjects();
    }
  }

  return (
    <main style={s.page}>
      <header style={s.head}>
        <div>
          <h1 style={s.h1}>Construction</h1>
          <p style={s.subtitle}>
            Projects, budgets, contracts, draws, and inspections.
          </p>
        </div>
        <button onClick={() => setShowModal(true)} style={s.newBtn}>
          <Plus size={14} />
          <span>New project</span>
        </button>
      </header>

      <ProjectsList
        projects={projects}
        loading={loading}
        error={error}
        onRetry={fetchProjects}
      />

      {showModal && (
        <NewProjectModal
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </main>
  );
}

const s = {
  page: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '24px 20px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  head: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    gap: 16,
  },
  h1: { margin: 0, fontSize: 28, color: tokens.textPrimary },
  subtitle: { margin: '4px 0 0', color: tokens.textSecondary, fontSize: 14 },
  newBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: tokens.primary,
    color: '#fff',
    border: 0,
    padding: '8px 14px',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    flexShrink: 0,
  },
};
