// components/PostComposer.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Props = {
  /** ID of the profile we're posting as */
  profileId: string;
  /** Called after a successful post so the parent can refresh */
  onPost?: () => void;
  /** Optional character limit (default 600) */
  limit?: number;
};

export default function PostComposer({ profileId, onPost, limit = 600 }: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const remaining = useMemo(() => Math.max(0, limit - text.length), [text, limit]);
  const disabled = busy || !text.trim() || text.length > limit;

  useEffect(() => setErr(''), [text]);

  async function submit() {
    if (disabled) return;
    try {
      setBusy(true);
      setErr('');

      const body = text.trim();
      const { error } = await supabase
        .from('posts')
        .insert({ profile_id: profileId, body })
        .select('id')
        .single();

      if (error) throw error;
      setText('');
      onPost?.();
    } catch (e: any) {
      setErr(e?.message ?? 'Could not publish post.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded border p-3">
      <div className="text-sm font-medium">Share an update</div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // Enter posts, Shift+Enter inserts a newline.
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        className="mt-1 w-full resize-none rounded border px-3 py-2 text-sm"
        rows={3}
        placeholder="What's on your mind?"
      />

      <div className="mt-1 flex items-center justify-between text-xs">
        <span>{remaining} characters left</span>
        {err && <span className="text-rose-600">{err}</span>}
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
