'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type CanSendResult = {
  ok: boolean;
  used: number;
  monthly_limit: number;
  remaining: number;
};

export default function RequestModal({
  title = 'Ask to Receive',
  placeholder = 'Share context and what you’re hoping for…',
  submitLabel = 'Ask to Receive',
  maxLength = 600,
  onCancel,
  onSubmit,
}: {
  title?: string;
  placeholder?: string;
  submitLabel?: string;
  maxLength?: number;
  onCancel: () => void;
  // Accept parents that use either (note) or (note, setBusy, setError)
  onSubmit: (
    note: string,
    setBusy?: (b: boolean) => void,
    setError?: (m: string) => void
  ) => void | Promise<void>;
}) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [status, setStatus] = useState(''); // small inline status line
  const [debugUsage, setDebugUsage] = useState<CanSendResult | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    taRef.current?.focus();
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onCancel]);

  const remainingChars = maxLength - note.length;
  const canSend = !busy && note.trim().length > 0 && remainingChars >= 0;

  async function handleSubmit() {
    const text = note.trim();
    if (!text) return;

    setErr('');
    setStatus('Checking quota…');
    setBusy(true);
    setDebugUsage(null);

    try {
      // 1) Must be signed in
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) {
        setErr('Please sign in.');
        return;
      }

      // 2) Ask DB whether we can send a request
      const { data, error } = await supabase
        .rpc('can_send_request', { p_profile_id: user.id })
        .single();

      if (error) {
        setErr(error.message || 'Could not check request quota.');
        return;
      }

      const chk = (data ?? null) as CanSendResult | null;

      if (!chk || typeof chk.ok !== 'boolean') {
        setErr('Could not check request quota.');
        return;
      }

      setDebugUsage(chk);

      if (!chk.ok) {
        setErr(`Monthly request limit reached (${chk.monthly_limit} per 30 days)`);
        setStatus('');
        return;
      }

      // 3) Under limit — proceed with the caller’s submit flow
      setStatus('Sending…');
      const maybePromise =
        onSubmit.length >= 3
          ? onSubmit(text, setBusy, setErr)
          : onSubmit(text);

      await Promise.resolve(maybePromise);

      setErr('');
      setStatus('Sent!');
      onCancel(); // close on success; parent navigates
    } catch (e: any) {
      setErr(e?.message ?? 'Could not send request.');
    } finally {
      setBusy(false);
      setTimeout(() => setStatus(''), 800);
    }
  }

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
              <span className={remainingChars < 0 ? 'text-red-600' : ''}>
                {remainingChars} characters left
              </span>
            </div>
          </div>

        {status && <div className="text-xs text-gray-500">{status}</div>}

          {err && (
            <div className="text-sm text-red-600">
              {err}
              {debugUsage && (
                <div className="mt-1 text-xs text-gray-500">
                  used: {debugUsage.used} · limit: {debugUsage.monthly_limit} · remaining:{' '}
                  {debugUsage.remaining}
                </div>
              )}
            </div>
          )}

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
              onClick={handleSubmit}
              className="hx-btn hx-btn--brand disabled:opacity-50"
            >
              {busy ? 'Sending…' : submitLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
