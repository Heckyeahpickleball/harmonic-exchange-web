// components/PostComposer.tsx
'use client';

import { useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';

type Props = {
  profileId: string;
  onPost?: (row: PostRow) => void; // let parent optimistically add
  limit?: number; // default 600
  /** Optional: when provided, the post will be scoped to a chapter */
  groupId?: string | null; // <-- NEW (pass null on Global page)
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
  const p = data?.profiles;
  const profiles = Array.isArray(p)
    ? (p[0] ? { display_name: p[0].display_name ?? null } : null)
    : p
    ? { display_name: p.display_name ?? null }
    : null;

  return {
    id: String(data.id),
    profile_id: String(data.profile_id),
    body: data.body ?? null,
    images: Array.isArray(data.images) ? data.images : data.images ? [data.images] : null,
    created_at: data.created_at ?? new Date().toISOString(),
    profiles,
  };
}

export default function PostComposer({ profileId, onPost, limit = 600, groupId = null }: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const remaining = useMemo(() => limit - text.length, [limit, text.length]);
  const disabled = busy || (!text.trim() && images.length === 0) || remaining < 0;

  async function uploadToPostMedia(file: File): Promise<string> {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) throw new Error('Not signed in');

    const path = `${uid}/${Date.now()}_${file.name}`;
    const { error } = await supabase
      .storage
      .from('post-media')
      .upload(path, file, { cacheControl: '3600', upsert: true, contentType: file.type });
    if (error) throw error;

    return supabase.storage.from('post-media').getPublicUrl(path).data.publicUrl;
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setErr('');
    setBusy(true);
    try {
      const urls: string[] = [];
      for (const f of Array.from(files).slice(0, 6 - images.length)) {
        urls.push(await uploadToPostMedia(f));
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
      const payload: any = {
        profile_id: profileId,
        body: text.trim() || null,        // allow empty when images exist
        images: images.length ? images : null,
      };
      // scope: null for global page, or specific chapter elsewhere
      payload.group_id = groupId ?? null;

      const { data, error } = await supabase
        .from('posts')
        .insert(payload)
        .select('id, profile_id, body, images, created_at, profiles(display_name)')
        .single();

      if (error) throw error;

      if (data && onPost) onPost(normalizePostRow(data)); // optimistic
      setText('');
      setImages([]);
    } catch (e: any) {
      setErr(e?.message ?? 'Could not post.');
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter = post, Shift+Enter = newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
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
