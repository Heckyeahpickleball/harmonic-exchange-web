// /components/RequestModal.tsx
'use client';

import { useEffect, useState } from 'react';

export default function RequestModal({
  title = 'Send a request',
  placeholder = 'Write a short note…',
  onCancel,
  onSubmit,
}: {
  title?: string;
  placeholder?: string;
  onCancel: () => void;
  onSubmit: (
    note: string,
    setBusy: (b: boolean) => void,
    setError: (m: string) => void
  ) => Promise<void> | void;
}) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-3"
      onClick={onCancel} // click backdrop to close
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()} // prevent backdrop close when clicking inside
      >
        <div className="border-b px-4 py-3">
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!note.trim()) return;
            await onSubmit(note.trim(), setBusy, setErr);
          }}
          className="grid gap-3 p-4"
        >
          <label className="text-sm font-medium">Note</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={5}
            className="w-full rounded border px-3 py-2"
            placeholder={placeholder}
          />
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-600">{note.trim().length} chars</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="rounded border px-4 py-2 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || !note.trim()}
                className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {busy ? 'Sending…' : 'Send request'}
              </button>
            </div>
          </div>

          {err && <p className="text-sm text-red-600">{err}</p>}
        </form>
      </div>
    </div>
  );
}
