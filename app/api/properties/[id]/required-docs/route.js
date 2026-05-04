// app/api/properties/[id]/required-docs/route.js
// GET — required-doc slots for a property, grouped by section/subsection,
//       with fulfilling document hydrated and a summary { required, fulfilled, not_applicable }.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(_req, { params }) {
  const supa = getSupabaseAdmin();

  const { data: slots, error } = await supa
    .from('required_doc_slots')
    .select(`
      id, status, fulfilled_by_document_id, marked_na_at, marked_na_reason, created_at,
      template:required_doc_templates!template_id (
        id, entity_type, section, subsection, title, description, sort_order
      ),
      document:documents!fulfilled_by_document_id (
        id, title, storage_bucket, storage_path, storage_url, mime_type, file_size_bytes, created_at
      )
    `)
    .eq('property_id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Sort by template.sort_order so rendering is deterministic.
  const sorted = (slots || []).slice().sort((a, b) =>
    (a.template?.sort_order ?? 0) - (b.template?.sort_order ?? 0)
  );

  // Group by section -> subsection.
  const grouped = {};
  for (const slot of sorted) {
    const sec = slot.template?.section || 'misc';
    const sub = slot.template?.subsection || '_';
    grouped[sec] ??= {};
    grouped[sec][sub] ??= [];
    grouped[sec][sub].push(slot);
  }

  const summary = sorted.reduce(
    (acc, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1;
      return acc;
    },
    { required: 0, fulfilled: 0, not_applicable: 0 }
  );

  return NextResponse.json({ slots: sorted, grouped, summary });
}
