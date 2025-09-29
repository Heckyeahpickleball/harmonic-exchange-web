// components/PostComposer.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Props = {
  profileId: string;            // author profile id (required)
  onPost?: () => void;          // optional: parent can refresh after a post
  limit?: number;               // max chars (default 600)
};

export default function PostComposer({ profileId, onPost, limit = 600 }: Props) {
  const [me, setMe] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const remaining = useMemo(() => Math.max(0, limit - text.length), [text, limit]);
  const disabled = !me || !text.trim() || busy;

  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!cancel) setMe(data.user?.id ?? null);
    })();
    return () => { cancel = true; };
  }, []);

  async function submit() {
    const body = text.trim();
    if (!body || !me) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('posts').insert({
        profile_id: profileId,   // write to the profile’s feed
        body,
      });
      if (error) throw error;
      setText('');
      onPost?.();
    } catch (e: any) {
      alert(e?.message ?? 'Could not post.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded border p-3">
      <label className="text-sm font-medium">Share an update</label>
      <textarea
        value={text}
        onChange={(e) => {
          const v = e.target.value;
          setText(v.length > limit ? v.slice(0, limit) : v);
        }}
        onKeyDown={(e) => {
          // Enter -> post; Shift+Enter -> newline
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void submit();
          }
        }}
        rows={3}
        placeholder="What’s on your mind?"
        className="mt-1 w-full resize-none rounded border px-3 py-2"
      />
      <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
        <span>{remaining} characters left</span>
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
