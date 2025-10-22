// components/GratitudeCarousel.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type FeedRow = {
  id: string;
  created_at: string;
  message: string | null;
  offer_id: string;
  offer_title: string | null;
  owner_id: string | null;
  owner_name: string | null;
  receiver_id: string | null;
  receiver_name: string | null;
};

const INTERVAL_MS = 2500;

export default function GratitudeCarousel() {
  const [rows, setRows] = useState<FeedRow[]>([]);
  const [i, setI] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Load public feed via SECURITY DEFINER RPC (RLS-safe for anon)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setErr(null);
      const { data, error } = await supabase.rpc('public_reviews_feed', { limit_n: 25 });
      if (cancelled) return;
      if (error) {
        console.error('GratitudeCarousel load error:', error);
        setErr(error.message);
        setRows([]);
        return;
      }
      setRows((data ?? []) as FeedRow[]);
    })();
    return () => { cancelled = true; };
  }, []);

  // Auto-advance
  useEffect(() => {
    if (!rows.length) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setI((p) => (p + 1) % rows.length), INTERVAL_MS);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [i, rows.length]);

  // Pause on hover
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onEnter = () => { if (timer.current) window.clearTimeout(timer.current); };
    const onLeave = () => setI((p) => (p + 0) % Math.max(rows.length, 1));
    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, [rows.length]);

  // Render states
  if (err) {
    return (
      <section aria-label="Past Exchanges" className="mx-auto max-w-6xl px-4">
        <div className="rounded-2xl border bg-white p-6">
          <h3 className="text-lg font-semibold text-gray-800">Gratitude from Past Exchanges</h3>
          <p className="mt-2 text-sm text-gray-600">Couldn’t load reviews.</p>
        </div>
      </section>
    );
  }

  if (rows.length === 0) {
    return (
      <section aria-label="Past Exchanges" className="mx-auto max-w-6xl px-4">
        <div className="rounded-2xl border bg-white p-6">
          <h3 className="text-lg font-semibold text-gray-800">Gratitude from Past Exchanges</h3>
          <p className="mt-2 text-sm text-gray-600">No public reviews yet.</p>
          <div className="mt-4">
            <Link href="/reviews" className="hx-btn hx-btn--outline-primary text-xs px-2 py-1">
              Past Exchanges
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const cur = rows[i];
  const created = new Date(cur.created_at).toLocaleDateString();
  const offerHref = `/offers/${cur.offer_id}`;

  return (
    <section aria-label="Past Exchanges" className="mx-auto max-w-6xl px-4">
      <div
        ref={wrapRef}
        className="flex items-stretch gap-3 overflow-hidden rounded-2xl border bg-white p-4"
      >
        <div className="min-w-0 flex-1">
          <div className="text-xs text-gray-500">{created}</div>
          <div className="mt-1 text-sm text-gray-800">
            <span className="font-medium">{cur.receiver_name || 'Receiver'}</span> on{' '}
            <Link href={offerHref} className="hx-link font-medium">
              {cur.offer_title || 'an offer'}
            </Link>{' '}
            from <span className="font-medium">{cur.owner_name || 'Provider'}</span>
          </div>
          <p className="mt-2 line-clamp-4 text-[15px] text-gray-800">{cur.message}</p>

          <div className="mt-3 flex items-center gap-2">
            <Link href="/reviews" className="hx-btn hx-btn--outline-primary text-xs px-2 py-1">
              Past Exchanges
            </Link>
            <div className="ml-auto text-xs text-gray-500">
              {i + 1} / {rows.length}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            aria-label="Previous"
            className="rounded-full border px-3 py-2 hover:bg-gray-50"
            onClick={() => setI((p) => (p === 0 ? rows.length - 1 : p - 1))}
          >
            ‹
          </button>
          <button
            aria-label="Next"
            className="rounded-full border px-3 py-2 hover:bg-gray-50"
            onClick={() => setI((p) => (p + 1) % rows.length)}
          >
            ›
          </button>
        </div>
      </div>
    </section>
  );
}
