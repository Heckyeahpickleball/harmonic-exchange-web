// /components/OfferGratitude.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Item = {
  id: string;
  created_at: string;
  message: string | null;
  author_id: string | null;
  author_name: string | null;
};

export default function OfferGratitude({
  offerId,
  offerTitle,
  limit = 3,
}: {
  offerId: string;
  offerTitle?: string;
  limit?: number;
}) {
  const pageStep = 5;

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [total, setTotal] = useState<number>(0);
  const [loaded, setLoaded] = useState<number>(0);

  const hasMore = total > loaded;

  async function load(n: number) {
    setLoading(true);
    setErr(null);
    const { data, error } = await supabase.rpc('public_reviews_for_offer', {
      p_offer_id: offerId,
      limit_n: n,
    });
    setLoading(false);
    if (error) {
      console.error('offer gratitude error:', error);
      setErr(error.message);
      setItems([]);
      setTotal(0);
      setLoaded(0);
      return;
    }
    const rows = (data ?? []) as Item[];
    setItems(rows);
    setLoaded(rows.length);
    // If the RPC doesn’t return a count, we treat “n” as the known size and allow “Show all” to try more.
    setTotal(Math.max(rows.length, n));
  }

  useEffect(() => {
    if (!offerId) return;
    load(limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offerId]);

  async function onShowMore() {
    const next = Math.min(loaded + pageStep, total || loaded + pageStep);
    await load(next);
  }
  async function onShowAll() {
    await load(Math.max(total, loaded + 20));
  }

  if (!offerId) return null;
  if (loading && items.length === 0) return null;
  if (err) return null;
  if (!items.length) return null;

  return (
    <div className="mt-4">
      <h3 className="mb-2 text-lg font-semibold">
        {`Recent Gratitude for ${offerTitle ?? 'this offer'}`}
      </h3>

      <ul className="space-y-2">
        {items.map((r) => (
          <li key={r.id} className="rounded border p-3">
            <div className="text-xs text-gray-500">
              {new Date(r.created_at).toLocaleString()}
              {r.author_name ? <> • from {r.author_name}</> : null}
            </div>
            <div className="mt-1 whitespace-pre-wrap text-sm">{r.message}</div>
          </li>
        ))}
      </ul>

      {hasMore && (
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={onShowMore}
            disabled={loading}
            className="rounded border px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-60"
          >
            {loading ? 'Loading…' : 'Show more'}
          </button>
          <button
            onClick={onShowAll}
            disabled={loading}
            className="rounded border px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-60"
          >
            {loading ? 'Loading…' : 'Show all'}
          </button>
        </div>
      )}
    </div>
  );
}
