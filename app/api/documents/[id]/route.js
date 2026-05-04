// app/api/documents/[id]/route.js
// GET    /api/documents/:id — metadata + signed download URL
// PATCH  /api/documents/:id — update title/description/section/subsection/notes/doc_type
// DELETE /api/documents/:id — delete row, remove from Storage, reset linked slot

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { signedUrlFor, deleteFromBucket } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const PATCHABLE_FIELDS = ['title', 'description', 'section', 'subsection', 'notes', 'doc_type'];

export async function GET(_request, { params }) {
  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from('documents')
    .select(`
      id, parent_type, parent_id, title, description, doc_type,
      section, subsection, mime_type, file_size_bytes,
      storage_bucket, storage_path, storage_url,
      uploaded_by, required_doc_slot_id, notes, created_at, updated_at,
      uploader:app_users!uploaded_by ( id, full_name, email )
    `)
    .eq('id', params.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 });

  let download_url = data.storage_url || null;
  if (data.storage_bucket && data.storage_path) {
    download_url = await signedUrlFor(data.storage_bucket, data.storage_path);
  }
  return NextResponse.json({ document: { ...data, download_url } });
}

export async function PATCH(request, { params }) {
  const body = await request.json();
  const update = {};
  for (const k of PATCHABLE_FIELDS) {
    if (k in body) update[k] = body[k];
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'no patchable fields supplied' }, { status: 400 });
  }
  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from('documents')
    .update(update)
    .eq('id', params.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ document: data });
}

export async function DELETE(_request, { params }) {
  const supa = getSupabaseAdmin();

  const { data: doc } = await supa
    .from('documents')
    .select('id, storage_bucket, storage_path, required_doc_slot_id')
    .eq('id', params.id)
    .maybeSingle();

  if (!doc) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // Delete the row first; storage cleanup is best-effort after.
  const { error: delErr } = await supa.from('documents').delete().eq('id', params.id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  // If this doc was filling a required slot, flip the slot back to required.
  if (doc.required_doc_slot_id) {
    await supa
      .from('required_doc_slots')
      .update({ status: 'required', fulfilled_by_document_id: null })
      .eq('id', doc.required_doc_slot_id);
  }

  // Remove the storage object.
  if (doc.storage_bucket && doc.storage_path) {
    await deleteFromBucket(doc.storage_bucket, doc.storage_path);
  }

  return NextResponse.json({ ok: true });
}
