'use client';

// app/construction/[id]/loans/[loanId]/page.js
// Loan detail — header summary + draws scoped to this loan via
// ScopedDrawsList. Edit header opens LoanModal.

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Banknote, Pencil, Trash2 } from 'lucide-react';
import { tokens } from '@/components/construction/_tokens';
import StatusPill from '@/components/construction/StatusPill';
import LoanModal from '@/components/construction/LoanModal';
import ScopedDrawsList from '@/components/construction/ScopedDrawsList';

export default function LoanDetailPage() {
  const router = useRouter();
  const { id: projectId, loanId } = useParams();

  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/construction/projects/${projectId}/loans/${loanId}`);
    if (r.status === 403) { setTimeout(() => router.push('/'), 200); return null; }
    if (r.status === 404) { setError('Loan not found.'); return null; }
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j.error || `HTTP ${r.status}`);
      return null;
    }
    return await r.json();
  }, [projectId, loanId, router]);

  const refresh = useCallback(async () => {
    const j = await load();
    if (j) setData(j);
  }, [load]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      const j = await load();
      if (!alive) return;
      if (j) setData(j);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [load]);

  async function handleDelete() {
    const drawCount = data?.draws?.length ?? 0;
    const confirmMsg = drawCount > 0
      ? `Delete this loan? ${drawCount} draw${drawCount === 1 ? '' : 's'} will become unlinked but keep their amounts.`
      : 'Delete this loan?';
    if (!confirm(confirmMsg)) return;
    setDeleting(true);
    try {
      const r = await fetch(`/api/construction/projects/${projectId}/loans/${loanId}`, { method: 'DELETE' });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${r.status}`);
      }
      router.push(`/construction/${projectId}`);
    } catch (e) {
      setError(e.message);
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <main style={s.page}>
        <BackLink projectId={projectId} />
        <div style={s.skel}>Loading…</div>
      </main>
    );
  }
  if (error) {
    return (
      <main style={s.page}>
        <BackLink projectId={projectId} />
        <div style={s.errorBox}>{error}</div>
      </main>
    );
  }
  if (!data) return null;

  const { loan } = data;

  return (
    <main style={s.page}>
      <BackLink projectId={projectId} />

      <section style={s.headCard}>
        <div style={s.headTop}>
          <Banknote size={18} style={{ color: tokens.textTertiary }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={s.lenderName}>
              {loan.lender_display_name || <span style={{ color: tokens.textTertiary, fontStyle: 'italic' }}>no lender</span>}
            </div>
            {loan.loan_number && <div style={s.loanNumber}>#{loan.loan_number}</div>}
          </div>
          <StatusPill status={loan.status} />
          <button onClick={() => setEditing(true)} style={s.editBtn}><Pencil size={14} /><span>Edit</span></button>
          <button onClick={handleDelete} disabled={deleting} style={s.deleteBtn}>
            <Trash2 size={14} /><span>{deleting ? 'Deleting…' : 'Delete'}</span>
          </button>
        </div>

        <div style={s.totals}>
          <Stat label="Total loan"   value={fmt(loan.total_loan_amount)} />
          <Stat label="Drawn"        value={fmt(loan.drawn_to_date)} />
          <Stat label="Available"    value={fmt(loan.available_balance)} red={loan.available_balance < 0} />
          <Stat label="% drawn"      value={`${loan.pct_drawn ?? 0}%`} />
          {loan.interest_rate != null && <Stat label="Interest rate" value={`${loan.interest_rate}%`} />}
        </div>

        {(loan.origination_date || loan.maturity_date) && (
          <div style={s.metaRow}>
            {loan.origination_date && <span><strong>Originated:</strong> {loan.origination_date}</span>}
            {loan.maturity_date    && <span><strong>Matures:</strong> {loan.maturity_date}</span>}
          </div>
        )}
      </section>

      <ScopedDrawsList
        projectId={projectId}
        loanId={loanId}
        loans={[loan]}
        subcontracts={[]}
        onChanged={refresh}
      />

      {editing && (
        <LoanModal
          projectId={projectId}
          loan={loan}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); refresh(); }}
        />
      )}
    </main>
  );
}

function BackLink({ projectId }) {
  return (
    <Link href={`/construction/${projectId}`} style={s.back}>
      <ChevronLeft size={16} />
      <span>Back to project</span>
    </Link>
  );
}

function Stat({ label, value, red }) {
  return (
    <div style={s.stat}>
      <div style={s.statLabel}>{label}</div>
      <div style={{ ...s.statValue, ...(red ? { color: tokens.errorText } : {}) }}>{value}</div>
    </div>
  );
}

function fmt(n) {
  return Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const s = {
  page: { maxWidth: 1100, margin: '0 auto', padding: '24px 20px', fontFamily: 'system-ui, -apple-system, sans-serif' },
  back: { display: 'inline-flex', alignItems: 'center', gap: 4, color: tokens.textSecondary, fontSize: 13, textDecoration: 'none', marginBottom: 16 },
  skel: { padding: 40, textAlign: 'center', color: tokens.textTertiary },
  errorBox: { padding: 16, background: tokens.errorBg, color: tokens.errorText, borderRadius: 8, fontSize: 14 },
  headCard: { background: tokens.surface, border: `1px solid ${tokens.border}`, borderRadius: 10, padding: 16, marginBottom: 12 },
  headTop: { display: 'flex', alignItems: 'center', gap: 12 },
  lenderName: { fontSize: 18, fontWeight: 600, color: tokens.textPrimary },
  loanNumber: { fontSize: 13, color: tokens.textSecondary, marginTop: 2 },
  totals: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginTop: 12, padding: 12, background: tokens.surfaceMuted, borderRadius: 6 },
  stat: { display: 'flex', flexDirection: 'column', gap: 2 },
  statLabel: { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, color: tokens.textTertiary },
  statValue: { fontSize: 16, fontWeight: 600, color: tokens.textPrimary },
  metaRow: { display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${tokens.surfaceMuted}`, fontSize: 12, color: tokens.textSecondary },
  editBtn: { display: 'inline-flex', alignItems: 'center', gap: 4, background: tokens.surface, color: tokens.textSecondary, border: `1px solid ${tokens.border}`, padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer' },
  deleteBtn: { display: 'inline-flex', alignItems: 'center', gap: 4, background: tokens.surface, color: tokens.errorText, border: `1px solid ${tokens.border}`, padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer' },
};
