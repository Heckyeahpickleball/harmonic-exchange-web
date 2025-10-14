'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type Review = {
  id: string;
  request_id: string;
  offer_id: string;
  owner_profile_id: string;
  receiver_profile_id: string;
  message: string;
  created_at: string;
};

type OfferRow = { id: string; title: string | null };
type ProfileRow = { id: string; display_name: string | null };

export default function GratitudeCarousel() {
  const [items, setItems] = useState<Review[]>([]);
  const [offers, setOffers] = useState<Record<string, OfferRow>>({});
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [i, setI] = useState(0);
  const timerRef = useRef<number | null>(null);

  // fetch latest 24 reviews (randomize client-side once)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('review_gratitudes')
        .select('id,request_id,offer_id,owner_profile_id,receiver_profile_id,message,created_at')
        .order('created_at', { ascending: false })
        .limit(24);

      if (cancelled) return;
      const rows = (data ?? []) as Review[];

      // Randomize order for fun variety
      for (let j = rows.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [rows[j], rows[k]] = [rows[k], rows[j]];
      }
      setItems(rows);

      // hydrate labels
      const offerIds = Array.from(new Set(rows.map(r => r.offer_id)));
      if (offerIds.length) {
        const { data: o } = await supabase
          .from('offers')
          .select('id,title')
          .in('id', offerIds);
        const map: Record<string, OfferRow> = {};
        (o ?? []).forEach((row) => (map[row.id] = row));
        setOffers(map);
      }

      const profIds = Array.from(new Set(rows.flatMap(r => [r.owner_profile_id, r.receiver_profile_id])));
      if (profIds.length) {
        const { data: p } = await supabase
          .from('profiles')
          .select('id,display_name')
          .in('id', profIds);
        const map: Record<string, ProfileRow> = {};
        (p ?? []).forEach((row) => (map[row.id] = row));
        setProfiles(map);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // auto-advance (does not block vertical scroll)
  useEffect(() => {
    if (!items.length) return;
    timerRef.current = window.setInterval(() => {
      setI((x) => (x + 1) % items.length);
    }, 3500);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [items.length]);

  if (!items.length) return null;

  const active = items[i];
  const owner = profiles[active.owner_profile_id]?.display_name || 'Provider';
  const receiver = profiles[active.receiver_profile_id]?.display_name || 'Receiver';
  const title = offers[active.offer_id]?.title || 'Offer';

  return (
    <div className="rounded-2xl border p-4 md:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">From the community</h3>
        <div className="flex items-center gap-2">
          <Link href="/reviews" className="rounded-full border px-3 py-1 text-sm hover:bg-gray-50">
            See all
          </Link>
          <div className="hidden sm:flex items-center gap-1">
            <button
              aria-label="Previous"
              onClick={() => setI((p) => (p === 0 ? items.length - 1 : p - 1))}
              className="rounded-full border px-3 py-1 hover:bg-gray-50"
            >‹</button>
            <button
              aria-label="Next"
              onClick={() => setI((p) => (p === items.length - 1 ? 0 : p + 1))}
              className="rounded-full border px-3 py-1 hover:bg-gray-50"
            >›</button>
          </div>
        </div>
      </div>

      <Link
        href="/reviews"
        className="block rounded-xl border bg-white/70 p-4 hover:bg-white/90 transition-colors"
      >
        <div className="text-[13px] text-gray-500">
          {new Date(active.created_at).toLocaleDateString()}
        </div>
        <div className="mt-1 text-sm text-gray-800">
          <span className="font-semibold">{receiver}</span> received <span className="font-semibold">“{title}”</span> from{' '}
          <span className="font-semibold">{owner}</span>
        </div>
        <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-gray-900 line-clamp-6">
          {active.message}
        </p>
      </Link>
    </div>
  );
}
