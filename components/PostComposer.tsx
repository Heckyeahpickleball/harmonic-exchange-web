// components/PostComposer.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';

type Props = {
  profileId: string;
  // Optional callback so parent can optimistically prepend the post
  onPost?: (row: PostRow) => void;
  limit?: number; // character limit (default 600)
};

export type PostRow = {
  id: string;
  profile_id: string;
  body: string | null;
  images: string[] | null;
  created_at: string;
  profiles?: { display_name: string | null } | null;
};

function normalizePostRow(data: any): PostRow {
  const base: PostRow = {
    id: String(data.id),
    profile_id: String(data.profile_id),
    body: data.body ?? null,
    images: Array.isArray(data.images) ? data.images : data.images ? [data.images] : null,
    created_at: data.created_at ?? new Date().toISOString(),
    profiles: null,
  };
  // Supabase sometimes returns 1:1 joins as arrays during insert-select.
  const p = (data as any)?.profiles;
  if (p && Array.isArray(p)) {
    base.profiles = p[0] ? { display_name: p[0].display_name ?? null } : null;
  } else if (p && typeof p === 'object') {
    base.profiles = { display_name: (p as any).display_name ?? null };
  }
  return base;
}

export default function PostComposer({ profileId, onPost, limit = 600 }: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // local attachments (data URLs after upload)
  const [images, setImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const remaining = useMemo(() => limit - text.length, [limit, text.length]);
  const disabled = busy || (!text.trim() && images.length === 0) || remaining < 0;

  // upload a single file to `post-media/{uid}/{timestamp}_{name}`
  async function uploadToPostMedia(file: File): Promise<string> {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) throw new Error('Not signed in');

    const path = `${uid}/${Date.now()}_${file.name}`;
    const { error: upErr } = await supabase.storage
      .from('post-media')
      .upload(path, file, { cacheControl: '3600', upsert: true, contentType: file.type });
    if (upErr) throw upErr;

    const { data } = supabase.storage.from('post-media').getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setErr('');
    setBusy(true);
    try {
      const urls: string[] = [];
      for (const f of Array.from(files).slice(0, 6 - images.length)) {
        const url = await uploadToPostMedia(f);
        urls.push(url);
      }
      setImages((prev) => [...prev, ...urls].slice(0, 6));
    } catch (e: any) {
      setErr(e?.message ?? 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (disabled) return;
    setBusy(true);
    setErr('');

    try {
      // RLS requires the row to belong to the current user
      const payload = {
        profile_id: profileId,
        body: text.trim() || null,
        images: images.length ? images : null,
      };

      const { data, error } = await supabase
        .from('posts')
        .insert(payload)
        .select('id, profile_id, body, images, created_at, profiles(display_name)')
        .single();

      if (error) throw error;

      // Optimistically add to UI (type-safe normalize to avoid Vercel TS error)
      if (data && onPost) {
        onPost(normalizePostRow(data));
      }

      // Clear composer
      setText('');
      setImages([]);
    } catch (e: any) {
      setErr(e?.message ?? 'Could not post.');
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter to post; Shift+Enter for newline (do NOT submit)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
    // if Shift+Enter, let it pass through (newline)
  }

  return (
    <div className="rounded-xl border p-3">
      <label className="block text-sm font-semibold">Share an update</label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        rows={3}
        className="mt-1 w-full resize-none rounded border px-3 py-2"
        placeholder="What's on your mind?"
      />

      {/* Attachments preview */}
      {images.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {images.map((src, i) => (
            <div key={i} className="relative h-20 w-28 overflow-hidden rounded border">
              <Image src={src} alt="" fill className="object-cover" />
              <button
                type="button"
                onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                className="absolute right-1 top-1 rounded bg-black/60 px-1 text-xs text-white"
                aria-label="Remove image"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded border px-2 py-1 text-sm"
            disabled={busy || images.length >= 6}
          >
            Add images
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              void handleFiles(e.currentTarget.files);
              e.currentTarget.value = '';
            }}
          />
          <span className="text-[11px] text-gray-500">
            Enter = Post · Shift+Enter = newline · Up to 6 images
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className={`text-xs ${remaining < 0 ? 'text-red-600' : 'text-gray-500'}`}>
            {remaining} characters left
          </span>
          <button
            type="button"
            onClick={submit}
            disabled={disabled}
            className="rounded bg-black px-3 py-1.5 text-white disabled:opacity-50"
          >
            {busy ? 'Posting…' : 'Post'}
          </button>
        </div>
      </div>

      {err && <p className="mt-2 text-sm text-amber-700">{err}</p>}
    </div>
  );
}
