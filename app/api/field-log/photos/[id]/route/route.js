// app/api/field-log/photos/[id]/route/route.js
//
// POST /api/field-log/photos/:id/route — route a tagged photo to its destination.
//
// 'issue':                copy to task-photos bucket, call Railway /tasks/rewrite
//                         on the note (vision-aware), create a tasks row with
//                         source='field_log', stash the public photo URL in
//                         tasks.issue_photos.
// 'progress' | 'reference': copy to platform-files bucket, create a documents
//                         row in section='5-photos-marketing' / subsection='site-visits'.
//
// In both cases, the field_log_photos row gets routed_to_* + resolved_status='routed'.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { copyBetweenBuckets, deleteFromBucket } from '@/lib/storage';
import { getSingletonOrgId, currentCallerId } from '@/lib/orgContext';

export const dynamic = 'force-dynamic';

const RAILWAY_URL = process.env.NEXT_PUBLIC_RAILWAY_URL
  || 'https://casitasenpueblo-agent-production.up.railway.app';

export async function POST(_request, { params }) {
  const supa = getSupabaseAdmin();

  const { data: photo } = await supa
    .from('field_log_photos')
    .select(`
      id, storage_path, photo_type, note, captured_at, captured_by,
      property_id, unit_id, project_id, resolved_status,
      property:properties!property_id ( id, short_name ),
      unit:units!unit_id ( id, unit_label ),
      project:projects!project_id ( id, name )
    `)
    .eq('id', params.id)
    .maybeSingle();

  if (!photo) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (photo.resolved_status === 'routed') {
    return NextResponse.json({ error: 'already routed' }, { status: 409 });
  }
  if (!(photo.property_id || photo.project_id)) {
    return NextResponse.json({ error: 'photo not tagged with a target' }, { status: 400 });
  }
  if (!photo.photo_type) {
    return NextResponse.json({ error: 'photo_type required' }, { status: 400 });
  }

  if (photo.photo_type === 'issue') {
    return await routeAsIssue(photo, supa);
  } else {
    return await routeAsDocument(photo, supa);
  }
}

async function routeAsIssue(photo, supa) {
  const orgId = await getSingletonOrgId();
  const callerId = await currentCallerId();

  // Copy to task-photos bucket. Use original filename suffix.
  const filename = photo.storage_path.split('/').pop();
  const newPath = `field-log/${photo.id}-${filename}`;
  try {
    await copyBetweenBuckets('field-log', photo.storage_path, 'task-photos', newPath);
  } catch (e) {
    return NextResponse.json({ error: `copy failed: ${e.message}` }, { status: 500 });
  }

  // task-photos is public — get the URL for vision rewrite + storage in tasks.issue_photos.
  const { data: pub } = supa.storage.from('task-photos').getPublicUrl(newPath);
  const photoUrl = pub?.publicUrl || null;

  // Ask Railway /tasks/rewrite to clean up the note. Best-effort: if it fails,
  // we still create the task with the raw note.
  let title = '';
  let description = photo.note || '';
  if (photo.note) {
    try {
      const propertyName = photo.property?.short_name || photo.project?.name || null;
      const r = await fetch(`${RAILWAY_URL}/tasks/rewrite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: photo.note, propertyName, photoUrl })
      });
      if (r.ok) {
        const j = await r.json();
        if (j.suggestedTitle)       title       = j.suggestedTitle;
        if (j.suggestedDescription) description = j.suggestedDescription;
      }
    } catch (e) {
      console.error('[field-log/route] rewrite failed:', e.message);
    }
  }

  if (!title) {
    const where = [photo.property?.short_name, photo.unit?.unit_label].filter(Boolean).join(' ');
    title = where ? `Issue at ${where}` : 'Field-log issue';
  }

  // Insert task. Tasks belongs to STR if property/unit; if project_id only, it's a construction task.
  const { data: task, error: taskErr } = await supa
    .from('tasks')
    .insert({
      org_id: orgId,
      title,
      description,
      original_description: photo.note || null,
      task_type: photo.project_id ? 'construction' : 'maintenance',
      status: 'pending',
      priority: 'medium',
      property_id: photo.property_id,
      unit_id: photo.unit_id,
      project_id: photo.project_id,
      issue_photos: photoUrl ? [photoUrl] : [],
      created_by_id: callerId,
      source: 'field_log'
    })
    .select()
    .single();

  if (taskErr) {
    // Try to clean up the copied photo
    await deleteFromBucket('task-photos', newPath);
    return NextResponse.json({ error: taskErr.message }, { status: 500 });
  }

  await supa.from('field_log_photos').update({
    routed_to_task_id: task.id,
    resolved_status: 'routed'
  }).eq('id', photo.id);

  return NextResponse.json({ ok: true, kind: 'task', task_id: task.id });
}

async function routeAsDocument(photo, supa) {
  const orgId = await getSingletonOrgId();

  const filename = photo.storage_path.split('/').pop();
  const parentType = photo.project_id ? 'project' : 'property';
  const parentId   = photo.project_id || photo.property_id;
  const newPath = `${parentType}/${parentId}/site-visits/${photo.id}-${filename}`;

  try {
    await copyBetweenBuckets('field-log', photo.storage_path, 'platform-files', newPath);
  } catch (e) {
    return NextResponse.json({ error: `copy failed: ${e.message}` }, { status: 500 });
  }

  const captureDate = new Date(photo.captured_at).toLocaleString();
  const title = photo.note || `Site visit photo — ${captureDate}`;

  const { data: doc, error: docErr } = await supa
    .from('documents')
    .insert({
      org_id: orgId,
      parent_type: parentType,
      parent_id: parentId,
      title,
      description: photo.note || null,
      doc_type: 'site_visit_photo',
      section: '5-photos-marketing',
      subsection: 'site-visits',
      storage_bucket: 'platform-files',
      storage_path: newPath,
      uploaded_by: photo.captured_by
    })
    .select()
    .single();

  if (docErr) {
    await deleteFromBucket('platform-files', newPath);
    return NextResponse.json({ error: docErr.message }, { status: 500 });
  }

  await supa.from('field_log_photos').update({
    routed_to_document_id: doc.id,
    resolved_status: 'routed'
  }).eq('id', photo.id);

  return NextResponse.json({ ok: true, kind: 'document', document_id: doc.id });
}
