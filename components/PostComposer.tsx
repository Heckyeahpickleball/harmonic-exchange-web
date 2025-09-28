// /components/PostComposer.tsx
'use client';

import { useState } from 'react';

export default function PostComposer({
  onPost,
}: {
  onPost: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const canPost = text.trim().length > 0 && !busy;

  return (
    <div className="rounded border p-3">
      <label className="mb-1 block text-sm font-medium">Write a post</label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className="w-full resize-none rounded border px-3 py-2 text-sm"
        placeholder="What's on your mind?"
      />
      <div className="mt-2 flex items-center justify-end">
        <button
          className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
          disabled={!canPost}
          onClick={async () => {
            if (!text.trim()) return;
            setBusy(true);
            try {
              await onPost(text);
              setText('');
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Posting…' : 'Post'}
        </button>
      </div>
    </div>
  );
}
