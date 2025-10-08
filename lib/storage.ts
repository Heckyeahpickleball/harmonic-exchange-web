/* HX v0.9.0 — 2025-10-07 — storage helpers for offer & event images
   File: lib/storage.ts

   Notes:
   - Keeps existing public API for offer images.
   - Adds uploadEventCoverImage() that uses the existing `post-media` bucket
     so you don't need to create a new bucket.
   - Robust URL→path parsing works with both `/storage/v1/object/public/...`
     and `/object/public/...`.
*/

import { supabase } from '@/lib/supabaseClient';

export const OFFER_BUCKET = 'offer-images';
// We will store event cover images in your existing post-media bucket.
export const POST_MEDIA_BUCKET = 'post-media';

// ---------- MIME / limits ----------
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_BYTES = 5 * 1024 * 1024;

/** Map MIME → preferred extension (fallback to jpg). */
function extFromMime(mime: string | undefined): string {
  switch (mime) {
    case 'image/jpeg': return 'jpg';
    case 'image/png':  return 'png';
    case 'image/webp': return 'webp';
    case 'image/gif':  return 'gif';
    default:           return 'jpg';
  }
}

// ---------- Public URL helpers (offer-images specific, preserved) ----------
/** Build a public URL from a storage object path (offer-images). */
export function publicUrlFromPath(path: string): string {
  const { data } = supabase.storage.from(OFFER_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Extract the storage object path from a Supabase public URL (offer-images).
 * Works with:
 *  - https://.../storage/v1/object/public/offer-images/USER/uuid.jpg
 *  - https://.../object/public/offer-images/USER/uuid.jpg
 * Handles optional querystrings.
 * Returns: "USER/uuid.jpg" or null if not parsable.
 */
export function objectPathFromPublicUrl(url: string): string | null {
  const m = url.match(/\/(?:storage\/v1\/)?object\/public\/offer-images\/(.+?)(?:\?|$)/);
  return m?.[1] ?? null;
}

/** Back-compat alias (in case other code references the old name). */
export const storagePathFromPublicUrl = objectPathFromPublicUrl;

// ---------- Offer image uploads (existing API, unchanged) ----------
/** Upload selected image Files to `${userId}/${uuid}.{ext}` and return public URLs (offer-images). */
export async function uploadOfferImages(userId: string, files: File[]): Promise<string[]> {
  if (!userId) throw new Error('Missing userId');
  if (!files?.length) return [];

  const urls: string[] = [];
  const errors: string[] = [];

  for (const file of files) {
    // Validation
    if (file.size > MAX_BYTES) {
      errors.push(`${file.name}: too large (max ${Math.round(MAX_BYTES / (1024 * 1024))}MB)`);
      continue;
    }
    if (file.type && !ALLOWED_MIME.has(file.type)) {
      errors.push(`${file.name}: unsupported type (${file.type || 'unknown'})`);
      continue;
    }

    const ext = extFromMime(file.type || undefined);
    const key = `${userId}/${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage
      .from(OFFER_BUCKET)
      .upload(key, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || `image/${ext}`,
      });

    if (error) {
      errors.push(`${file.name}: ${error.message}`);
      continue;
    }

    const { data } = supabase.storage.from(OFFER_BUCKET).getPublicUrl(key);
    urls.push(data.publicUrl);
  }

  if (urls.length === 0 && errors.length) {
    throw new Error(errors.join(' | '));
  }

  return urls;
}

/** Delete a single offer image by its public URL. */
export async function removeOfferImageByUrl(url: string): Promise<void> {
  const path = objectPathFromPublicUrl(url);
  if (!path) throw new Error('Invalid image URL.');
  const { error } = await supabase.storage.from(OFFER_BUCKET).remove([path]);
  if (error) throw error;
}

/** Batch delete helper (array of offer-image public URLs). */
export async function removeOfferImagesByUrls(urls: string[]): Promise<void> {
  const paths = urls.map(objectPathFromPublicUrl).filter((p): p is string => Boolean(p));
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(OFFER_BUCKET).remove(paths);
  if (error) throw error;
}

// ---------- Generic helpers (for post-media / events) ----------
/** Build a public URL from a storage object path for an arbitrary bucket. */
function publicUrlFor(bucket: string, path: string): string {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Upload a single image file to a given bucket/path prefix, returning the public URL. */
async function uploadImageToBucket(params: {
  bucket: string;
  userId: string;
  file: File;
  prefix?: string; // e.g. "events"
  upsert?: boolean;
}): Promise<string> {
  const { bucket, userId, file, prefix, upsert } = params;

  if (!userId) throw new Error('Missing userId');
  if (!file) throw new Error('Missing file');

  if (file.size > MAX_BYTES) {
    throw new Error(`${file.name}: too large (max ${Math.round(MAX_BYTES / (1024 * 1024))}MB)`);
  }
  if (file.type && !ALLOWED_MIME.has(file.type)) {
    throw new Error(`${file.name}: unsupported type (${file.type || 'unknown'})`);
  }

  const ext = extFromMime(file.type || undefined);
  const key = `${userId}/${prefix ? `${prefix}/` : ''}${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(bucket).upload(key, file, {
    cacheControl: '3600',
    upsert: Boolean(upsert),
    contentType: file.type || `image/${ext}`,
  });
  if (error) throw error;

  return publicUrlFor(bucket, key);
}

// ---------- NEW: Event cover uploads (uses existing post-media bucket) ----------
/**
 * Upload an event cover image into the existing `post-media` bucket,
 * under `${userId}/events/${uuid}.{ext}`.
 */
export async function uploadEventCoverImage(userId: string, file: File): Promise<string> {
  return uploadImageToBucket({
    bucket: POST_MEDIA_BUCKET,
    userId,
    file,
    prefix: 'events',
    upsert: true,
  });
}
