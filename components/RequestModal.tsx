// /components/RequestModal.tsx
'use client';

import { useEffect, useRef, useState } from 'react';

export default function RequestModal({
  title = 'Ask for support',
  placeholder = 'Share context and what you’re hoping for…',
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
        <div className="mb-3">
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-gray-600">
            Speak from the heart. Clear, kind words help others understand how to show up for you.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium">Your note</label>
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
              <span>Gratitude goes a long way.</span>
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
              className="hx-btn hx-btn--ghost"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canSend}
              onClick={() => onSubmit(note.trim(), setBusy, setErr)}
              className="hx-btn hx-btn--brand disabled:opacity-50"
            >
              {busy ? 'Sending…' : 'Send ask'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
