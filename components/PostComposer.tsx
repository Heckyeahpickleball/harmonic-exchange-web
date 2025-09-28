// /components/PostComposer.tsx
'use client';

import { useState } from 'react';

export default function PostComposer({
  onPost,
}: {
  onPost: (text: string) => Promise<void> | void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const canPost = text.trim().length > 0 && !busy;

  async function submit() {
    if (!canPost) return;
    setBusy(true);
    const body = text.trim();
    try {
      await onPost(body);
      setText('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded border p-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className="w-full resize-none rounded border px-3 py-2 text-sm"
        placeholder="Share an update…"
      />
      <div className="mt-2 text-right">
        <button
          onClick={submit}
          disabled={!canPost}
          className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          {busy ? 'Posting…' : 'Post'}
        </button>
      </div>
    </div>
  );
}
