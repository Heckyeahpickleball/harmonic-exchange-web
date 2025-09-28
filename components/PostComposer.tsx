// /components/PostComposer.tsx
'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Props = {
  /** Preferred: current user's profile id for direct insert */
  profileId?: string;
  /** Optional: notify parent after a successful create (direct mode) */
  onCreated?: (postId: string) => void;
  /**
   * Back-compat: legacy callback mode. If provided, composer will call this
   * instead of inserting to Supabase itself.
   */
  onPost?: (text: string) => Promise<void> | void;
};

const MAX_LEN = 600;

export default function PostComposer({ profileId, onCreated, onPost }: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>('');

  const body = text.trim();
  const remaining = MAX_LEN - body.length;
  const disabled = busy || body.length === 0 || body.length > MAX_LEN;

  async function submit() {
    if (disabled) return;
    setBusy(true);
    setErr('');

    try {
      if (onPost) {
        // Legacy callback mode
        await onPost(body);
        setText('');
        try {
          window.dispatchEvent(new CustomEvent('hx:post-created', { detail: { profile_id: profileId } }));
        } catch {}
        return;
      }

      // Direct insert mode
      if (!profileId) {
        setErr('Not signed in.');
        return;
      }

      const { data, error } = await supabase
        .from('posts')
        .insert({ profile_id: profileId, body })
        .select('id')
        .single();

      if (error) throw error;

      setText('');

      try {
        window.dispatchEvent(
          new CustomEvent('hx:post-created', {
            detail: { post_id: data?.id, profile_id: profileId },
          })
        );
      } catch {}

      onCreated?.(data?.id as string);
    } catch (e: any) {
      const msg = typeof e?.message === 'string' ? e.message : String(e);
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded border p-3">
      <label className="mb-1 block text-sm font-medium">Share an update</label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className="w-full resize-none rounded border px-3 py-2 text-sm"
        placeholder="What’s on your mind?"
      />
      <div className="mt-1 flex items-center justify-between text-xs text-gray-600">
        <span>{remaining} characters left</span>
        {err && <span className="text-red-600">{err}</span>}
      </div>
      <div className="mt-2 text-right">
        <button
          onClick={submit}
          disabled={disabled}
          className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          {busy ? 'Posting…' : 'Post'}
        </button>
      </div>
    </div>
  );
}
