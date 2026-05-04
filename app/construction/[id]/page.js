'use client';

// app/construction/[id]/page.js
// Project detail. Phase 1 = header card live; sections b–h are stubs.

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft, FolderOpen,
} from 'lucide-react';
import { tokens } from '@/components/construction/_tokens';
import ProjectHeader from '@/components/construction/ProjectHeader';
import ProjectStubSection from '@/components/construction/ProjectStubSection';
import BudgetSection from '@/components/construction/BudgetSection';
import PhasesSection from '@/components/construction/PhasesSection';
import ExpensesSection from '@/components/construction/ExpensesSection';
import SubcontractsSection from '@/components/construction/SubcontractsSection';
import LoansSection from '@/components/construction/LoansSection';
import DrawsSection from '@/components/construction/DrawsSection';
import TasksSection from '@/components/construction/TasksSection';
import ChangeOrdersSection from '@/components/construction/ChangeOrdersSection';
import InspectionsSection from '@/components/construction/InspectionsSection';

export default function ConstructionProjectPage() {
  const router = useRouter();
  const { id } = useParams();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProject = useCallback(async () => {
    const r = await fetch(`/api/construction/projects/${id}`);
    if (r.status === 403) {
      setTimeout(() => router.push('/'), 200);
      return null;
    }
    if (r.status === 404) {
      setError('Project not found.');
      return null;
    }
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j.error || `HTTP ${r.status}`);
      return null;
    }
    return await r.json();
  }, [id, router]);

  const refresh = useCallback(async () => {
    const j = await fetchProject();
    if (j) setData(j);
  }, [fetchProject]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      const j = await fetchProject();
      if (!alive) return;
      if (j) setData(j);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [fetchProject]);

  if (loading) {
    return (
      <main style={s.page}>
        <BackLink />
        <div style={s.skel}>Loading…</div>
      </main>
    );
  }
  if (error) {
    return (
      <main style={s.page}>
        <BackLink />
        <div style={s.errorBox}>{error}</div>
      </main>
    );
  }
  if (!data) return null;

  return (
    <main style={s.page}>
      <BackLink />

      <ProjectHeader
        project={data.project}
        financials={data.financials}
        counts={data.counts}
        onChanged={refresh}
      />

      <BudgetSection projectId={id} />
      <PhasesSection projectId={id} />
      <ExpensesSection projectId={id} />
      <SubcontractsSection projectId={id} />
      <LoansSection projectId={id} />
      <DrawsSection projectId={id} />
      <TasksSection projectId={id} />
      <ChangeOrdersSection projectId={id} />
      <InspectionsSection projectId={id} />

      <ProjectStubSection
        title="Files & contacts"
        phase="phase 6"
        icon={FolderOpen}
        description="Project Drive folder, key contacts (architect, GC, lender, inspector), permits and COIs."
      />
    </main>
  );
}

function BackLink() {
  return (
    <Link href="/construction" style={s.back}>
      <ChevronLeft size={16} />
      <span>Back to Construction</span>
    </Link>
  );
}

const s = {
  page: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '24px 20px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  back: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    color: tokens.textSecondary,
    fontSize: 13,
    textDecoration: 'none',
    marginBottom: 16,
  },
  skel: { padding: 40, textAlign: 'center', color: tokens.textTertiary },
  errorBox: {
    padding: 16,
    background: tokens.errorBg,
    color: tokens.errorText,
    borderRadius: 8,
    fontSize: 14,
  },
};
