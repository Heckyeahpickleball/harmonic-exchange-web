'use client';

import { useEffect, useRef, useState } from 'react';

type AskQuotaSummary = {
  used: number;
  limit: number;
  remaining: number;
  window: 'last_30_days';
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

  const [quota, setQuota] = useState<AskQuotaSummary | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(true);
  const [quotaErr, setQuotaErr] = useState<string | null>(null);

  useEffect(() => {
    taRef.current?.focus();
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onCancel]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      try {
        setQuotaLoading(true);
        setQuotaErr(null);
        const res = await fetch('/api/requests/quota', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = await res
          .json()
          .catch(() => null) as AskQuotaSummary | { error?: string } | null;
        if (!res.ok || !payload || typeof payload !== 'object' || 'error' in payload) {
          throw new Error((payload as any)?.error || 'Unable to load your ask quota.');
        }
        if (cancelled) return;
        setQuota({
          used: Number(payload.used ?? 0),
          limit: Number(payload.limit ?? 0),
          remaining: Number(payload.remaining ?? 0),
          window: (payload.window ?? 'last_30_days') as 'last_30_days',
        });
        setQuotaLoading(false);
      } catch (e: any) {
        if (cancelled || e?.name === 'AbortError') return;
        setQuota(null);
        setQuotaErr('Unable to verify your ask quota right now.');
        setQuotaLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const charsRemaining = maxLength - note.length;
  const limitReached = !!quota && quota.remaining <= 0;
  const canSend =
    !busy &&
    note.trim().length > 0 &&
    charsRemaining >= 0 &&
    !quotaLoading &&
    !limitReached;

  async function handleSubmit() {
    const trimmed = note.trim();
    if (!trimmed || busy) return;

    setBusy(true);
    setErr('');

    try {
      const res = await fetch('/api/requests/quota', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      });
      const payload = await res
        .json()
        .catch(() => null) as
        | (AskQuotaSummary & { error?: never })
        | { quota?: AskQuotaSummary; error?: string }
        | null;

      if (!res.ok) {
        const quotaPayload = (payload && 'quota' in (payload as any) ? (payload as any).quota : null) as
          | AskQuotaSummary
          | null;
        if (quotaPayload) setQuota(quotaPayload);
        const message = (payload as any)?.error ||
          (res.status === 429
            ? 'You have reached your ask limit for the last 30 days.'
            : 'We could not verify your ask quota. Please try again.');
        setErr(message);
        setBusy(false);
        return;
      }

      const quotaPayload =
        (payload && 'used' in (payload as any)
          ? (payload as any as AskQuotaSummary)
          : (payload as any)?.quota) || null;
      if (quotaPayload) setQuota(quotaPayload);

      await onSubmit(trimmed, setBusy, setErr);
      setBusy(false);
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setErr(e?.message ?? 'Could not send your ask.');
      setBusy(false);
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
              <span className={charsRemaining < 0 ? 'text-red-600' : ''}>
                {charsRemaining} characters left
              </span>
            </div>
            {!quotaLoading && quota && (
              <div className="mt-2 text-xs text-gray-600">
                You’ve used {quota.used} of {quota.limit} asks in the last 30 days.
              </div>
            )}
            {!quotaLoading && !quota && quotaErr && (
              <div className="mt-2 text-xs text-amber-600">{quotaErr}</div>
            )}
            {quotaLoading && (
              <div className="mt-2 text-xs text-gray-500">Checking your ask quota…</div>
            )}
            {limitReached && (
              <div className="mt-2 text-sm text-red-600">
                You’ve reached your ask limit for the last 30 days.
              </div>
            )}
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
