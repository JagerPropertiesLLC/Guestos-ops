// app/api/documents/route.js
// GET  /api/documents — list documents for a parent
//   Filter modes (mutually exclusive — pick one):
//     ?parent_type=X&parent_id=Y
//     ?property_id=X        (shorthand for parent_type=property)
//     ?unit_id=X            (parent_type=unit)
//     ?project_id=X         (parent_type=project)
//     ?company_id=X         (parent_type=company)
//     ?contact_id=X         (parent_type=contact)
//     ?subcontract_id=X | ?project_draw_id=X | ?change_order_id=X | ?inspection_id=X | ?task_id=X
// POST /api/documents — multipart upload (file + metadata)

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { getSingletonOrgId, currentCallerId } from '@/lib/orgContext';
import { uploadToBucket, signedUrlFor, buildStoragePath } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const VALID_PARENT_TYPES = [
  'property', 'unit', 'project', 'subcontract', 'project_draw',
  'change_order', 'inspection', 'task', 'contact', 'company'
];

function resolveParent(searchParams) {
  const direct = {
    type: searchParams.get('parent_type'),
    id:   searchParams.get('parent_id')
  };
  if (direct.type && direct.id) return direct;

  const shorthandMap = {
    property_id:      'property',
    unit_id:          'unit',
    project_id:       'project',
    subcontract_id:   'subcontract',
    project_draw_id:  'project_draw',
    change_order_id:  'change_order',
    inspection_id:    'inspection',
    task_id:          'task',
    contact_id:       'contact',
    company_id:       'company'
  };
  for (const [param, type] of Object.entries(shorthandMap)) {
    const id = searchParams.get(param);
    if (id) return { type, id };
  }
  return { type: null, id: null };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const { type, id } = resolveParent(searchParams);
  if (!type || !id) {
    return NextResponse.json({ error: 'parent_type+parent_id (or shorthand) required' }, { status: 400 });
  }
  if (!VALID_PARENT_TYPES.includes(type)) {
    return NextResponse.json({ error: `invalid parent_type: ${type}` }, { status: 400 });
  }

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
    .eq('parent_type', type)
    .eq('parent_id', id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Generate signed URLs for documents stored in private buckets.
  const enriched = await Promise.all((data || []).map(async (d) => {
    let download_url = d.storage_url || null;
    if (d.storage_bucket && d.storage_path) {
      download_url = await signedUrlFor(d.storage_bucket, d.storage_path);
    }
    return { ...d, download_url };
  }));

  return NextResponse.json({ documents: enriched });
}

export async function POST(request) {
  const callerId = await currentCallerId();
  const orgId = await getSingletonOrgId();

  let parent_type, parent_id, title, description, section, subsection, fulfills_slot_id, doc_type;
  let file = null;

  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const fd = await request.formData();
    file = fd.get('file');
    parent_type = fd.get('parent_type');
    parent_id   = fd.get('parent_id');
    title       = fd.get('title');
    description = fd.get('description') || null;
    section     = fd.get('section') || null;
    subsection  = fd.get('subsection') || null;
    fulfills_slot_id = fd.get('fulfills_slot_id') || null;
    doc_type    = fd.get('doc_type') || null;
  } else {
    return NextResponse.json({ error: 'multipart/form-data required' }, { status: 400 });
  }

  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'file required' }, { status: 400 });
  }
  if (!parent_type || !parent_id) {
    return NextResponse.json({ error: 'parent_type and parent_id required' }, { status: 400 });
  }
  if (!VALID_PARENT_TYPES.includes(parent_type)) {
    return NextResponse.json({ error: `invalid parent_type: ${parent_type}` }, { status: 400 });
  }
  if (!title) {
    title = file.name || 'Untitled';
  }

  const supa = getSupabaseAdmin();

  // If this upload fulfills a required-doc slot, sanity-check the slot exists
  // and matches the parent before reserving the upload.
  if (fulfills_slot_id) {
    const { data: slot, error: slotErr } = await supa
      .from('required_doc_slots')
      .select('id, property_id, unit_id, company_id, status')
      .eq('id', fulfills_slot_id)
      .maybeSingle();
    if (slotErr || !slot) {
      return NextResponse.json({ error: 'fulfills_slot_id not found' }, { status: 400 });
    }
    const slotParentMatches =
      (parent_type === 'property' && slot.property_id === parent_id) ||
      (parent_type === 'unit'     && slot.unit_id     === parent_id) ||
      (parent_type === 'company'  && slot.company_id  === parent_id);
    if (!slotParentMatches) {
      return NextResponse.json({ error: 'fulfills_slot_id parent mismatch' }, { status: 400 });
    }
  }

  // Upload file to platform-files bucket.
  const buffer = Buffer.from(await file.arrayBuffer());
  const path = buildStoragePath(`${parent_type}/${parent_id}`, file.name);
  try {
    await uploadToBucket('platform-files', path, buffer, file.type);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  // Insert document row.
  const { data: doc, error: insErr } = await supa
    .from('documents')
    .insert({
      org_id: orgId,
      parent_type,
      parent_id,
      title,
      description,
      doc_type,
      section,
      subsection,
      storage_bucket: 'platform-files',
      storage_path: path,
      mime_type: file.type || null,
      file_size_bytes: typeof file.size === 'number' ? file.size : null,
      uploaded_by: callerId,
      required_doc_slot_id: fulfills_slot_id
    })
    .select()
    .single();

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  // If linked to a slot, flip slot to fulfilled.
  if (fulfills_slot_id) {
    await supa
      .from('required_doc_slots')
      .update({ status: 'fulfilled', fulfilled_by_document_id: doc.id })
      .eq('id', fulfills_slot_id);
  }

  const download_url = await signedUrlFor('platform-files', path);
  return NextResponse.json({ document: { ...doc, download_url } });
}
