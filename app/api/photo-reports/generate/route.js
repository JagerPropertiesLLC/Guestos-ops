// app/api/photo-reports/generate/route.js
//
// POST { entity_type, entity_id, start_date, end_date, title? }
//
// Builds a PDF of progress + reference site-visit photos for the entity within
// the date range, uploads it to platform-files, returns a signed URL. The
// branding header is "Casitas En Pueblo" for property reports and "DuraCo
// Properties" for construction project reports (text headers, no logo this phase).

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { uploadToBucket, signedUrlFor, buildStoragePath } from '@/lib/storage';
import { buildPhotoReportPdf } from '@/lib/photoReportPdf';
import { getSingletonOrgId, currentCallerId } from '@/lib/orgContext';

export const dynamic = 'force-dynamic';

const HEADER_BY_TYPE = {
  property: 'CASITAS EN PUEBLO',
  unit:     'CASITAS EN PUEBLO',
  project:  'DURACO PROPERTIES'
};

export async function POST(request) {
  const body = await request.json();
  const { entity_type, entity_id, start_date, end_date, title } = body;

  if (!entity_type || !entity_id) {
    return NextResponse.json({ error: 'entity_type and entity_id required' }, { status: 400 });
  }
  if (!['property', 'unit', 'project'].includes(entity_type)) {
    return NextResponse.json({ error: 'entity_type must be property | unit | project' }, { status: 400 });
  }

  const supa = getSupabaseAdmin();

  // Pull entity name for cover page subtitle.
  let entityName = '';
  if (entity_type === 'property') {
    const { data } = await supa.from('properties').select('short_name, full_address').eq('id', entity_id).maybeSingle();
    entityName = data ? `${data.short_name} — ${data.full_address}` : '';
  } else if (entity_type === 'project') {
    const { data } = await supa.from('projects').select('name, address').eq('id', entity_id).maybeSingle();
    entityName = data ? `${data.name}${data.address ? ` — ${data.address}` : ''}` : '';
  } else if (entity_type === 'unit') {
    const { data } = await supa.from('units').select('unit_label, property_id').eq('id', entity_id).maybeSingle();
    entityName = data?.unit_label || '';
  }

  // Build the document filter. Site-visit photos live in documents with
  // section='5-photos-marketing', subsection='site-visits'.
  let q = supa.from('documents')
    .select('id, title, description, mime_type, storage_bucket, storage_path, created_at')
    .eq('parent_type', entity_type)
    .eq('parent_id', entity_id)
    .eq('subsection', 'site-visits')
    .order('created_at', { ascending: true });

  if (start_date) q = q.gte('created_at', `${start_date}T00:00:00Z`);
  if (end_date)   q = q.lte('created_at', `${end_date}T23:59:59Z`);

  const { data: docs, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!docs || docs.length === 0) {
    return NextResponse.json({ error: 'no_photos_in_range' }, { status: 404 });
  }

  // Download each photo's bytes.
  const photoBytes = await Promise.all(docs.map(async (d) => {
    if (!d.storage_bucket || !d.storage_path) return null;
    try {
      const { data: blob, error: dErr } = await supa.storage.from(d.storage_bucket).download(d.storage_path);
      if (dErr || !blob) return null;
      const buf = Buffer.from(await blob.arrayBuffer());
      return {
        bytes: buf,
        mime: d.mime_type || (d.storage_path.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'),
        captured_at: d.created_at,
        caption: d.description || d.title || ''
      };
    } catch {
      return null;
    }
  }));

  const photos = photoBytes.filter(Boolean);
  if (photos.length === 0) {
    return NextResponse.json({ error: 'all_photos_failed_to_load' }, { status: 500 });
  }

  const headerBrand = HEADER_BY_TYPE[entity_type] || 'PROPERTY REPORT';
  const reportTitle = title || `${entityName || 'Photo Report'} — Photos`;
  const dateRangeLabel = `${start_date || 'all-time'} → ${end_date || 'today'}`;

  const pdfBytes = await buildPhotoReportPdf({
    title: reportTitle,
    headerBrand,
    dateRangeLabel,
    entitySubtitle: entityName,
    photos
  });

  // Save the PDF in platform-files under reports/.
  const orgId = await getSingletonOrgId();
  const callerId = await currentCallerId();
  const reportPath = buildStoragePath(`reports/${entity_type}/${entity_id}`, `photo-report-${start_date || 'all'}-${end_date || 'now'}.pdf`);
  await uploadToBucket('platform-files', reportPath, Buffer.from(pdfBytes), 'application/pdf');

  // Stash a documents row so the generated report itself shows up in the All
  // Files tab.
  await supa.from('documents').insert({
    org_id: orgId,
    parent_type: entity_type,
    parent_id: entity_id,
    title: reportTitle,
    description: `Photo report ${dateRangeLabel} (${photos.length} photos)`,
    doc_type: 'photo_report',
    section: '5-photos-marketing',
    subsection: 'reports',
    storage_bucket: 'platform-files',
    storage_path: reportPath,
    mime_type: 'application/pdf',
    file_size_bytes: pdfBytes.length,
    uploaded_by: callerId
  });

  const url = await signedUrlFor('platform-files', reportPath);
  return NextResponse.json({ ok: true, url, photo_count: photos.length });
}
