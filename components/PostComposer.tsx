'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Props = {
  profileId: string;
  onPost?: (newPost: any) => void;
  limit?: number; // kept for parity with other callers
};

export default function PostComposer({ profileId, onPost }: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // image state
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => previews.forEach((u) => URL.revokeObjectURL(u));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addImages(newFiles: File[]) {
    if (!newFiles?.length) return;
    const nextFiles = [...files, ...newFiles].slice(0, 6);
    const nextPreviews = [
      ...previews,
      ...newFiles.map((f) => URL.createObjectURL(f)),
    ].slice(0, 6);
    setFiles(nextFiles);
    setPreviews(nextPreviews);
  }

  function onChooseFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const f = Array.from(e.currentTarget.files || []).filter((f) =>
      f.type.startsWith('image/')
    );
    addImages(f);
    e.currentTarget.value = '';
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const f = Array.from(e.dataTransfer.files || []).filter((f) =>
      f.type.startsWith('image/')
    );
    addImages(f);
  }

  function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = Array.from(e.clipboardData?.items || []);
    const imgFiles = items
      .filter((it) => it.kind === 'file' && it.type.startsWith('image/'))
      .map((it) => it.getAsFile())
      .filter(Boolean) as File[];
    addImages(imgFiles);
  }

  async function uploadAllImages(userId: string, imgs: File[]): Promise<string[]> {
    if (!imgs.length) return [];
    const bucket = supabase.storage.from('post-media');
    const urls: string[] = [];

    for (const f of imgs) {
      const path = `${userId}/${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}_${f.name}`;
      const { error } = await bucket.upload(path, f, {
        cacheControl: '3600',
        upsert: true,
        contentType: f.type || 'image/*',
      });
      if (error) throw error;
      const { data } = bucket.getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    return urls;
  }

  async function submit() {
    if (busy) return;
    const body = text.trim();
    if (!body && files.length === 0) return;

    setBusy(true);
    setErr('');
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error('Not signed in');

      // upload images first
      const imageUrls = await uploadAllImages(uid, files);

      // insert post
      const { data, error } = await supabase
        .from('posts')
        .insert({
          profile_id: profileId,
          body: body || ' ', // keep a space if only images
          images: imageUrls,
        })
        .select('*')
        .single();
      if (error) throw error;

      // reset
      setText('');
      previews.forEach((u) => URL.revokeObjectURL(u));
      setFiles([]);
      setPreviews([]);

      onPost?.(data);
    } catch (e: any) {
      setErr(e?.message ?? 'Could not post.');
    } finally {
      setBusy(false);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter posts, Shift+Enter makes a newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div
      className="rounded border p-3"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <label className="text-sm font-medium">Share an update</label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKey}
        onPaste={onPaste}
        rows={3}
        className="mt-1 w-full resize-none rounded border px-3 py-2"
        placeholder="What's on your mind?"
      />

      {previews.length > 0 && (
        <div className="mt-2 grid grid-cols-3 gap-2">
          {previews.map((u, i) => (
            <div key={i} className="relative overflow-hidden rounded border">
              <img src={u} alt="" className="h-24 w-full object-cover" />
              <button
                type="button"
                className="absolute right-1 top-1 rounded bg-black/60 px-1 text-xs text-white"
                onClick={() => {
                  URL.revokeObjectURL(previews[i]);
                  setPreviews((p) => p.filter((_, idx) => idx !== i));
                  setFiles((p) => p.filter((_, idx) => idx !== i));
                }}
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
            onClick={() => fileRef.current?.click()}
            className="rounded border px-2 py-1 text-sm"
          >
            Add images
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={onChooseFiles}
          />
          <span className="text-xs text-gray-500">
            Enter = Post · Shift+Enter = newline · Up to 6 images
          </span>
        </div>

        <button
          onClick={submit}
          disabled={busy}
          className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          {busy ? 'Posting…' : 'Post'}
        </button>
      </div>

      {err && <p className="mt-2 text-sm text-amber-700">{err}</p>}
    </div>
  );
}
