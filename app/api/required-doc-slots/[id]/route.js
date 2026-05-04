// app/api/required-doc-slots/[id]/route.js
// PATCH — update a slot's status. Used to mark 'not_applicable' (with reason)
// or revert back to 'required'. Setting 'fulfilled' directly is not allowed
// here — that happens via document upload which links the document to the slot.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { currentCallerId } from '@/lib/orgContext';

export const dynamic = 'force-dynamic';

const ALLOWED_TRANSITIONS = ['required', 'not_applicable'];

export async function PATCH(request, { params }) {
  const body = await request.json();
  const { status, reason } = body;

  if (!ALLOWED_TRANSITIONS.includes(status)) {
    return NextResponse.json(
      { error: `status must be one of ${ALLOWED_TRANSITIONS.join(', ')}; use the upload endpoint to mark fulfilled` },
      { status: 400 }
    );
  }

  const supa = getSupabaseAdmin();
  const { data: existing } = await supa
    .from('required_doc_slots')
    .select('id, status, fulfilled_by_document_id')
    .eq('id', params.id)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // Block flipping a fulfilled slot to required/N/A without first deleting the
  // attached document (use DELETE /api/documents/:id which clears the link).
  if (existing.status === 'fulfilled' && existing.fulfilled_by_document_id) {
    return NextResponse.json(
      { error: 'slot is fulfilled; delete the linked document to free the slot' },
      { status: 409 }
    );
  }

  const update = { status, fulfilled_by_document_id: null };
  if (status === 'not_applicable') {
    update.marked_na_at = new Date().toISOString();
    update.marked_na_by = await currentCallerId();
    update.marked_na_reason = reason || null;
  } else {
    update.marked_na_at = null;
    update.marked_na_by = null;
    update.marked_na_reason = null;
  }

  const { data, error } = await supa
    .from('required_doc_slots')
    .update(update)
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ slot: data });
}
