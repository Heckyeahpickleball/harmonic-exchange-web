'use client';

import { useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { OFFER_BUCKET, uploadOfferImages } from '@/lib/storage';

type Props = {
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number; // default 4
};

/** Convert a public URL into a storage object path */
function toStoragePath(publicUrl: string) {
  const marker = `/storage/v1/object/public/${OFFER_BUCKET}/`;
  const i = publicUrl.indexOf(marker);
  if (i === -1) return null;
  return publicUrl.slice(i + marker.length);
}

export default function UploadImages({ value, onChange, max = 4 }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    try {
      setBusy(true);
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id;
      if (!userId) throw new Error('Please sign in.');

      // Limit total to max
      const remaining = Math.max(0, max - (value?.length ?? 0));
      const chosen = files.slice(0, remaining);

      const urls = await uploadOfferImages(userId, chosen);
      onChange([...(value || []), ...urls]);
    } catch (err: any) {
      setError(err?.message || 'Upload failed');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function removeUrl(u: string) {
    setError(null);
    // optimistic remove
    onChange((value || []).filter((v) => v !== u));

    const path = toStoragePath(u);
    if (!path) return;

    try {
      const { error } = await supabase.storage.from(OFFER_BUCKET).remove([path]);
      if (error) throw error;
    } catch (err: any) {
      // revert on failure
      onChange([...(value || []), u]);
      setError(err?.message || 'Could not delete image from storage.');
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">Image upload</label>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        disabled={busy || (value?.length ?? 0) >= (max ?? 4)}
        onChange={handleSelect}
        className="block w-full rounded border p-2"
      />

      {!!value?.length && (
        <div className="flex flex-wrap gap-3">
          {value.map((u) => (
            <div key={u} className="relative">
              <img
                src={u}
                alt="Offer image"
                width={120}
                height={90}
                className="h-[90px] w-[120px] rounded border object-cover"
                loading="lazy"
              />
              <button
                type="button"
                onClick={() => removeUrl(u)}
                className="absolute right-1 top-1 rounded bg-black/70 px-1 text-xs text-white"
                aria-label="Remove image"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {busy && <p className="text-sm text-gray-600">Uploading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-gray-500">Up to {max} images. JPG/PNG/WebP recommended.</p>
    </div>
  );
}
