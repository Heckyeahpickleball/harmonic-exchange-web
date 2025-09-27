'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Props = {
  bucket: 'avatars' | 'covers';
  profileId: string;
  label: string;
  currentUrl?: string | null;
  onUploaded: (publicUrl: string) => void;
};

export default function ProfileImageUploader({ bucket, profileId, label, currentUrl, onUploaded }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setErr('');
    try {
      const path = `${profileId}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type,
      });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      onUploaded(data.publicUrl);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? 'Upload failed');
    } finally {
      setBusy(false);
      e.currentTarget.value = '';
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      {currentUrl ? (
        <div className="rounded border p-2">
          <img src={currentUrl} alt={label} className="max-h-40 w-full object-cover" />
        </div>
      ) : (
        <div className="rounded border p-4 text-sm text-gray-500">No image set</div>
      )}
      <div className="flex items-center gap-3">
        <input type="file" accept="image/*" onChange={onFile} disabled={busy} />
        {busy && <span className="text-xs text-gray-600">Uploading…</span>}
      </div>
      {err && <p className="text-xs text-rose-700">{err}</p>}
    </div>
  );
}
