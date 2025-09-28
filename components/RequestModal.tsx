// /components/RequestModal.tsx
'use client';

import { useEffect, useRef, useState } from 'react';

export default function RequestModal({
  title = 'Send a request',
  placeholder = 'Add a short note…',
  maxLength = 600,
  onCancel,
  onSubmit,
}: {
  title?: string;
  placeholder?: string;
  maxLength?: number;
  onCancel: () => void;
  onSubmit: (
    note: string,
    setBusy: (b: boolean) => void,
    setError: (m: string) => void
  ) => void | Promise<void>;
}) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    taRef.current?.focus();
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onCancel]);

  const remaining = maxLength - note.length;
  const canSend = !busy && note.trim().length > 0 && remaining >= 0;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-xl rounded-xl bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          {/* removed duplicate Cancel button from header */}
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium">Note</label>
            <textarea
              ref={taRef}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={5}
              maxLength={maxLength}
              placeholder={placeholder}
              className="mt-1 w-full resize-y rounded border p-2 text-sm"
            />
            <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
              <span>Tell the owner what you’re hoping for.</span>
              <span className={remaining < 0 ? 'text-red-600' : ''}>
                {remaining} characters left
              </span>
            </div>
          </div>

          {err && <div className="text-sm text-red-600">{err}</div>}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded border px-3 py-2 text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canSend}
              onClick={() => onSubmit(note.trim(), setBusy, setErr)}
              className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {busy ? 'Sending…' : 'Send request'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
