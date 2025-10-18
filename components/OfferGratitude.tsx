// /components/OfferGratitude.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type GratitudeItem = {
  id: string;
  created_at: string;
  text: string;
  author_name?: string | null; // the receiver who wrote the thank-you
  author_id?: string | null;   // link to profile when present
};

export default function OfferGratitude({
  offerId,
  offerTitle,
  limit = 3, // initial number to show
}: {
  offerId: string;
  offerTitle?: string;
  limit?: number;
}) {
  const pageStep = 5; // how many to load each "Show more" click

  const [items, setItems] = useState<GratitudeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [total, setTotal] = useState<number>(0);   // total rows available
  const [loaded, setLoaded] = useState<number>(0); // how many we’ve loaded so far

  const hasMore = useMemo(() => total > loaded, [total, loaded]);

  // ---- Mapping helper (reviews only) ----------------------------------------
  function mapFromReviews(rows: any[]): GratitudeItem[] {
    return (rows || []).map((g: any) => ({
      id: g.id as string,
      created_at: g.created_at as string,
      text: (g.message as string) ?? '',
      author_name: g.receiver?.display_name ?? null,
      author_id: g.receiver_profile_id ?? null,
    }));
  }

  // ---- Initial load: read ONLY from the reviews view/table -------------------
  useEffect(() => {
    let cancelled = false;

    async function tryReviews(first: number) {
      // Prefer the consolidated view `gratitude_reviews` (or adjust to your exact view name).
      // If the optional `published` column doesn’t exist in your env, gracefully fall back.
      const run = async (withPublished: boolean) => {
        const sel = supabase
          .from('gratitude_reviews')
          .select(
            `
            id,
            created_at,
            message,
            ${withPublished ? 'published,' : ''}
            offer_id,
            receiver_profile_id,
            receiver:profiles!gratitude_reviews_receiver_profile_id_fkey(display_name)
          `,
            { count: 'exact' }
          )
          .eq('offer_id', offerId)
          .order('created_at', { ascending: false })
          .range(0, Math.max(first - 1, 0));

        if (withPublished) sel.eq('published', true);

        const { data, error, count } = await sel;
        return { data, error, count: count ?? 0, withPublished };
      };

      const a = await run(true);
      const missingPublished =
        a.error && String(a.error.message || '').toLowerCase().includes('column "published"');
      const b = missingPublished ? await run(false) : null;

      const pick = missingPublished ? b! : a;
      if (pick.error) throw pick.error;

      const rows = mapFromReviews(pick.data || []);
      return { rows, count: pick.count };
    }

    async function init() {
      setLoading(true);
      setErr(null);
      try {
        const r = await tryReviews(limit);
        if (!cancelled) {
          setItems(r.rows);
          setTotal(r.count);
          setLoaded(r.rows.length);
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? 'Could not load reviews.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [offerId, limit]);

  // ---- Pagination (reviews only) --------------------------------------------
  async function loadTo(newSize: number) {
    try {
      setLoading(true);

      const run = async (withPublished: boolean) => {
        const sel = supabase
          .from('gratitude_reviews')
          .select(
            `
            id,
            created_at,
            message,
            ${withPublished ? 'published,' : ''}
            offer_id,
            receiver_profile_id,
            receiver:profiles!gratitude_reviews_receiver_profile_id_fkey(display_name)
          `
          )
          .eq('offer_id', offerId)
          .order('created_at', { ascending: false })
          .range(0, Math.max(newSize - 1, 0));

        if (withPublished) sel.eq('published', true);

        const { data, error } = await sel;
        return { data, error, withPublished };
      };

      const a = await run(true);
      const missingPublished =
        a.error && String(a.error.message || '').toLowerCase().includes('column "published"');
      const b = missingPublished ? await run(false) : null;

      const pick = missingPublished ? b! : a;
      if (pick.error) throw pick.error;

      const rows = mapFromReviews(pick.data || []);
      setItems(rows);
      setLoaded(rows.length);
    } catch (e) {
      console.warn('[OfferGratitude] loadTo failed:', e);
    } finally {
      setLoading(false);
    }
  }

  async function onShowMore() {
    const next = Math.min(loaded + pageStep, total || loaded + pageStep);
    await loadTo(next);
  }

  async function onShowAll() {
    if (total > 0) {
      await loadTo(total);
    } else {
      await loadTo(200);
    }
  }

  // ---- Render ---------------------------------------------------------------
  if (loading && items.length === 0) return null;
  if (err) return null;
  if (!items.length) return null;

  return (
    <div className="mt-4">
      <h3 className="mb-2 text-lg font-semibold">
        {`Recent Gratitude for ${offerTitle ?? 'this offer'}`}
      </h3>

      <ul className="space-y-2">
        {items.map((g) => (
          <li key={g.id} className="rounded border p-3">
            <div className="text-xs text-gray-500">
              {new Date(g.created_at).toLocaleString()}{' '}
              {g.author_name ? (
                g.author_id ? (
                  <>
                    • from{' '}
                    <Link href={`/u/${g.author_id}`} className="underline">
                      {g.author_name}
                    </Link>
                  </>
                ) : (
                  <>• from {g.author_name}</>
                )
              ) : null}
            </div>
            <div className="mt-1 whitespace-pre-wrap text-sm">{g.text}</div>
          </li>
        ))}
      </ul>

      {(hasMore) && (
        <div className="mt-3 flex items-center gap-2">
          {hasMore && (
            <button
              onClick={onShowMore}
              disabled={loading}
              className="rounded border px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-60"
            >
              {loading ? 'Loading…' : 'Show more'}
            </button>
          )}
          {hasMore && (
            <button
              onClick={onShowAll}
              disabled={loading}
              className="rounded border px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-60"
            >
              {loading ? 'Loading…' : 'Show all'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
