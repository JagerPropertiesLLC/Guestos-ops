'use client';

// app/construction/[id]/subcontracts/[subId]/page.js
// Subcontract detail page — hosts the schedule of values (LineItemsEditor)
// plus a header summary and an edit-header button (SubcontractModal in edit
// mode). Future scope (lien waivers, COIs, change orders scoped to this
// subcontract) lives here too.

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, FileSignature, Pencil, Trash2 } from 'lucide-react';
import { tokens } from '@/components/construction/_tokens';
import StatusPill from '@/components/construction/StatusPill';
import SubcontractModal from '@/components/construction/SubcontractModal';
import LineItemsEditor from '@/components/construction/LineItemsEditor';
import LineItemsRollupBar from '@/components/construction/LineItemsRollupBar';
import ScopedDrawsList from '@/components/construction/ScopedDrawsList';

export default function SubcontractDetailPage() {
  const router = useRouter();
  const { id: projectId, subId } = useParams();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/construction/projects/${projectId}/subcontracts/${subId}`);
    if (r.status === 403) { setTimeout(() => router.push('/'), 200); return null; }
    if (r.status === 404) { setError('Subcontract not found.'); return null; }
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j.error || `HTTP ${r.status}`);
      return null;
    }
    return await r.json();
  }, [projectId, subId, router]);

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
    if (!confirm('Delete this subcontract? All line items will be deleted too.')) return;
    setDeleting(true);
    try {
      const r = await fetch(`/api/construction/projects/${projectId}/subcontracts/${subId}`, { method: 'DELETE' });
      if (r.status === 409) {
        const j = await r.json().catch(() => ({}));
        if (j.error === 'has_draws') {
          throw new Error(`Cannot delete: ${j.count} draw${j.count === 1 ? '' : 's'} reference${j.count === 1 ? 's' : ''} this subcontract. Delete or detach the draws first.`);
        }
        throw new Error(j.error || `HTTP 409`);
      }
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

  const { subcontract, line_items } = data;

  return (
    <main style={s.page}>
      <BackLink projectId={projectId} />

      <section style={s.headCard}>
        <div style={s.headTop}>
          <FileSignature size={18} style={{ color: tokens.textTertiary }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={s.vendorName}>
              {subcontract.vendor_name || <span style={{ color: tokens.textTertiary, fontStyle: 'italic' }}>no vendor</span>}
            </div>
            <div style={s.scopeText}>{subcontract.scope}</div>
          </div>
          <StatusPill status={subcontract.status} />
          <button onClick={() => setEditing(true)} style={s.editBtn} title="Edit header">
            <Pencil size={14} /><span>Edit</span>
          </button>
          <button onClick={handleDelete} disabled={deleting} style={s.deleteBtn} title="Delete subcontract">
            <Trash2 size={14} /><span>{deleting ? 'Deleting…' : 'Delete'}</span>
          </button>
        </div>

        {(subcontract.contract_signed_date || subcontract.retainage_pct != null) && (
          <div style={s.metaRow}>
            {subcontract.contract_signed_date && (
              <span><strong>Signed:</strong> {subcontract.contract_signed_date}</span>
            )}
            {subcontract.retainage_pct != null && (
              <span><strong>Retainage default:</strong> {subcontract.retainage_pct}%</span>
            )}
          </div>
        )}
      </section>

      <LineItemsRollupBar subcontract={subcontract} />

      <LineItemsEditor
        projectId={projectId}
        subcontractId={subId}
        retainagePctDefault={subcontract.retainage_pct}
        lineItems={line_items}
        onChanged={refresh}
      />

      <ScopedDrawsList
        projectId={projectId}
        subcontractId={subId}
        subcontracts={[subcontract]}
        loans={[]}
        onChanged={refresh}
      />

      {editing && (
        <SubcontractModal
          projectId={projectId}
          subcontract={subcontract}
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

const s = {
  page: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '24px 20px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  back: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    color: tokens.textSecondary, fontSize: 13,
    textDecoration: 'none', marginBottom: 16,
  },
  skel: { padding: 40, textAlign: 'center', color: tokens.textTertiary },
  errorBox: {
    padding: 16, background: tokens.errorBg, color: tokens.errorText,
    borderRadius: 8, fontSize: 14,
  },
  headCard: {
    background: tokens.surface,
    border: `1px solid ${tokens.border}`,
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
  },
  headTop: { display: 'flex', alignItems: 'center', gap: 12 },
  vendorName: { fontSize: 18, fontWeight: 600, color: tokens.textPrimary },
  scopeText: { fontSize: 13, color: tokens.textSecondary, marginTop: 2 },
  metaRow: {
    display: 'flex', flexWrap: 'wrap', gap: 16,
    marginTop: 12, paddingTop: 12,
    borderTop: `1px solid ${tokens.surfaceMuted}`,
    fontSize: 12, color: tokens.textSecondary,
  },
  editBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    background: tokens.surface, color: tokens.textSecondary,
    border: `1px solid ${tokens.border}`,
    padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
  },
  deleteBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    background: tokens.surface, color: tokens.errorText,
    border: `1px solid ${tokens.border}`,
    padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
  },
};
