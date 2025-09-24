/* HX v0.8 — 2025-09-23 — storage helpers for offer images
   File: lib/storage.ts

   Notes:
   - Preserves existing public API:
       - export const OFFER_BUCKET
       - export async function uploadOfferImages(userId, files): Promise<string[]>
   - Adds delete helpers + validation (type/size).
*/

import { supabase } from '@/lib/supabaseClient';

export const OFFER_BUCKET = 'offer-images';

// Accept JPG/PNG/WebP/GIF up to 5 MB each (tweak as needed)
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_BYTES = 5 * 1024 * 1024;

/** Map MIME → preferred extension (fallback to jpg) */
function extFromMime(mime: string | undefined): string {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    default:
      return 'jpg';
  }
}

/** Build a public URL from a storage object path. */
export function publicUrlFromPath(path: string): string {
  const { data } = supabase.storage.from(OFFER_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Extract the storage object path from a Supabase public URL.
 * Handles optional querystrings (e.g., signed URLs) as well.
 * Example:
 *  https://xyz.supabase.co/storage/v1/object/public/offer-images/USER/uuid.jpg
 *   → USER/uuid.jpg
 */
export function objectPathFromPublicUrl(url: string): string | null {
  const m = url.match(/\/storage\/v1\/object\/public\/offer-images\/(.+?)(?:\?|$)/);
  return m?.[1] ?? null;
}

/** Back-compat alias (in case other code references the old name). */
export function storagePathFromPublicUrl(url: string): string | null {
  return objectPathFromPublicUrl(url);
}

/** Upload selected image Files to `${userId}/${uuid}.{ext}` and return public URLs. */
export async function uploadOfferImages(userId: string, files: File[]): Promise<string[]> {
  if (!userId) throw new Error('Missing userId');
  if (!files?.length) return [];

  const urls: string[] = [];
  const errors: string[] = [];

  for (const file of files) {
    // Basic validation (keeps UX friendly, avoids weird uploads)
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

    const { error } = await supabase.storage.from(OFFER_BUCKET).upload(key, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || `image/${ext}`,
    });

    if (error) {
      errors.push(`${file.name}: ${error.message}`);
      continue;
    }

    urls.push(publicUrlFromPath(key));
  }

  if (urls.length === 0 && errors.length) {
    // If *everything* failed, surface a single clear error
    throw new Error(errors.join(' | '));
  }

  return urls;
}

/** Delete a single image by its public URL. */
export async function removeOfferImageByUrl(url: string): Promise<void> {
  const path = objectPathFromPublicUrl(url);
  if (!path) throw new Error('Invalid image URL.');
  const { error } = await supabase.storage.from(OFFER_BUCKET).remove([path]);
  if (error) throw error;
}

/** Optional: batch delete helper. */
export async function removeOfferImagesByUrls(urls: string[]): Promise<void> {
  const paths = urls
    .map(objectPathFromPublicUrl)
    .filter((p): p is string => Boolean(p));
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(OFFER_BUCKET).remove(paths);
  if (error) throw error;
}
