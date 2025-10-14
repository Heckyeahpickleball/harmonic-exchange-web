// /components/ReviewsCarousel.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type Row = {
  id: string;
  request_id: string | null;
  offer_id: string | null;
  owner_profile_id: string | null;     // provider
  receiver_profile_id: string | null;  // receiver (author)
  message: string | null;              // actual text field you write
  created_at: string;
};

type OfferRow = { id: string; title: string | null };
type ProfileRow = { id: string; display_name: string | null };

const INTERVAL_MS = 2500;

export default function ReviewsCarousel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [offers, setOffers] = useState<Record<string, OfferRow>>({});
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [i, setI] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Pull recent public gratitudes
      const { data, error } = await supabase
        .from('review_gratitudes')
        .select('id,request_id,offer_id,owner_profile_id,receiver_profile_id,message,created_at')
        .order('created_at', { ascending: false })
        .limit(25);

      if (cancelled) return;
      if (!error && data) {
        setRows(data as Row[]);

        // hydrate labels
        const offerIds = Array.from(new Set((data as Row[]).map(r => r.offer_id).filter(Boolean) as string[]));
        if (offerIds.length) {
          const { data: o } = await supabase
            .from('offers')
            .select('id,title')
            .in('id', offerIds);
          const map: Record<string, OfferRow> = {};
          (o ?? []).forEach((row) => (map[row.id] = row));
          setOffers(map);
        }

        const profIds = Array.from(new Set(
          (data as Row[]).flatMap(r => [r.owner_profile_id, r.receiver_profile_id]).filter(Boolean) as string[]
        ));
        if (profIds.length) {
          const { data: p } = await supabase
            .from('profiles')
            .select('id,display_name')
            .in('id', profIds);
          const map: Record<string, ProfileRow> = {};
          (p ?? []).forEach((row) => (map[row.id] = row));
          setProfiles(map);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // auto-advance
  useEffect(() => {
    if (rows.length === 0) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setI((p) => (p + 1) % rows.length);
    }, INTERVAL_MS);
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
  const offerTitle = (cur.offer_id && offers[cur.offer_id]?.title) || 'an offer';
  const receiverName = (cur.receiver_profile_id && profiles[cur.receiver_profile_id]?.display_name) || 'Receiver';
  const ownerName = (cur.owner_profile_id && profiles[cur.owner_profile_id]?.display_name) || 'Provider';

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
            <span className="font-medium">{receiverName}</span> on <span className="font-medium">{offerTitle}</span>
          </div>
          <p className="mt-2 line-clamp-3 text-[15px] text-gray-800">
            {cur.message}
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
