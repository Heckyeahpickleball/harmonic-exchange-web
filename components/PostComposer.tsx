// /components/PostComposer.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Props = {
  profileId: string;
  onCreated?: () => void;
  onPost?: (body: string) => void;
  limit?: number; // char limit
};

export default function PostComposer({ profileId, onCreated, onPost, limit = 600 }: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // submit
  const submit = useCallback(async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setErr('');
    try {
      const { error } = await supabase.from('posts').insert({
        profile_id: profileId,
        body,
      });
      if (error) throw error;
      setText('');
      onCreated?.();
      onPost?.(body);
    } catch (e: any) {
      setErr(e?.message ?? 'Could not post.');
    } finally {
      setBusy(false);
    }
  }, [text, busy, profileId, onCreated, onPost]);

  // keyboard behavior
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Ctrl/Cmd+Enter always posts
    const ctrlOrCmd = e.ctrlKey || e.metaKey;
    if (e.key === 'Enter' && (ctrlOrCmd || !e.shiftKey)) {
      // Enter submits; Shift+Enter is newline
      e.preventDefault();
      submit();
    }
    // otherwise allow Shift+Enter for newline (default)
  }

  const remaining = limit - text.length;
  const disabled = busy || text.trim().length === 0 || remaining < 0;

  return (
    <div className="rounded border p-3">
      <label className="text-sm font-medium">Share an update</label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        rows={3}
        className="mt-1 w-full resize-none rounded border px-3 py-2 text-sm"
        placeholder="What's on your mind?"
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
