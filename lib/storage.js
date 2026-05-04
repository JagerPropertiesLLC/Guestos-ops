// lib/storage.js
// Server-side helpers for the platform-files and field-log buckets.
// Both buckets are private — read access goes through signed URLs.

import { getSupabaseAdmin } from './supabaseServer';

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

export async function uploadToBucket(bucket, path, fileBuffer, contentType) {
  const supa = getSupabaseAdmin();
  const { error } = await supa.storage.from(bucket).upload(path, fileBuffer, {
    contentType: contentType || 'application/octet-stream',
    upsert: false
  });
  if (error) throw new Error(`storage upload to ${bucket}/${path} failed: ${error.message}`);
  return { bucket, path };
}

export async function copyBetweenBuckets(srcBucket, srcPath, destBucket, destPath) {
  const supa = getSupabaseAdmin();
  const { data: blob, error: dErr } = await supa.storage.from(srcBucket).download(srcPath);
  if (dErr) throw new Error(`download from ${srcBucket}/${srcPath} failed: ${dErr.message}`);
  const buffer = Buffer.from(await blob.arrayBuffer());
  return uploadToBucket(destBucket, destPath, buffer, blob.type);
}

export async function signedUrlFor(bucket, path, ttl = SIGNED_URL_TTL_SECONDS) {
  if (!bucket || !path) return null;
  const supa = getSupabaseAdmin();
  const { data, error } = await supa.storage.from(bucket).createSignedUrl(path, ttl);
  if (error) {
    console.error(`[storage] signed url failed ${bucket}/${path}:`, error.message);
    return null;
  }
  return data?.signedUrl || null;
}

export async function deleteFromBucket(bucket, path) {
  if (!bucket || !path) return;
  const supa = getSupabaseAdmin();
  const { error } = await supa.storage.from(bucket).remove([path]);
  if (error) {
    console.error(`[storage] delete failed ${bucket}/${path}:`, error.message);
  }
}

// Sanitize a filename for use in a storage path. Keeps the extension and a
// short slug of the original stem; everything else gets a timestamp + random
// suffix to avoid collisions.
export function buildStoragePath(prefix, originalName) {
  const safeOriginal = (originalName || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60);
  const stamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}/${stamp}-${rand}-${safeOriginal}`;
}
