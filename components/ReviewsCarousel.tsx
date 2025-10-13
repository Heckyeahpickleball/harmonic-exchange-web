'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type Row = {
  request_id: string | null;
  offer_id: string | null;
  quote: string | null;
  owner_name: string | null;
  receiver_name: string | null;
  created_at: string;
  offer_title: string | null;
};

const INTERVAL_MS = 4000;

export default function ReviewsCarousel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [i, setI] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('review_gratitudes')
        .select('request_id,offer_id,quote,owner_name,receiver_name,created_at,offer_title')
        .order('created_at', { ascending: false })
        .limit(25);

      if (!cancelled && !error && data) setRows(data as Row[]);
    })();
    return () => { cancelled = true; };
  }, []);

  // auto-advance
  useEffect(() => {
    if (rows.length === 0) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setI((p) => (p + 1) % rows.length);
    }, INTERVAL_MS) as unknown as number;
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [i, rows.length]);

  // pause on hover
  const wrapRef = useRef<HTMLDivElement>(null);
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

  // EMPTY STATE — show a friendly card if no public reviews yet
  if (rows.length === 0) {
    return (
      <section aria-label="Past Exchanges" className="mx-auto max-w-6xl px-4">
        <div className="rounded-2xl border bg-white p-6">
          <h3 className="text-lg font-semibold text-gray-800">Gratitude from Past Exchanges</h3>
          <p className="mt-2 text-sm text-gray-600">
            No public reviews yet. Be the first to share gratitude after your next exchange!
          </p>
          <div className="mt-4 flex gap-2">
            <Link href="/browse" className="hx-btn hx-btn--primary">Explore Offerings</Link>
            <Link href="/reviews/new" className="hx-btn hx-btn--outline-primary">Write a Review</Link>
          </div>
        </div>
      </section>
    );
  }

  const cur = rows[i];

  return (
    <section aria-label="Past Exchanges" className="mx-auto max-w-6xl px-4">
      <div
        ref={wrapRef}
        className="flex items-stretch gap-3 overflow-hidden rounded-2xl border bg-white p-4"
      >
        {/* left: copy */}
        <div className="min-w-0 flex-1">
          <div className="text-xs text-gray-500">{new Date(cur.created_at).toLocaleString()}</div>
          <div className="mt-1 text-sm">
            <span className="font-medium">{cur.receiver_name ?? 'Receiver'}</span>{' '}
            on{' '}
            <span className="font-medium">{cur.offer_title ?? 'an offer'}</span>
          </div>
          <p className="mt-2 line-clamp-3 text-[15px] text-gray-800">
            {cur.quote}
          </p>

          <div className="mt-3 flex items-center gap-2">
            <Link href="/reviews" className="hx-btn hx-btn--outline-primary text-xs px-2 py-1">
              Past Exchanges
            </Link>
            <div className="ml-auto text-xs text-gray-500">
              {i + 1} / {rows.length}
            </div>
          </div>
        </div>

        {/* right: controls */}
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
