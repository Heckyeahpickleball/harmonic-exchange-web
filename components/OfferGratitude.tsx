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
  author_id?: string | null;   // NEW: link to profile when present
};

type Source = 'gratitude_reviews' | 'notifications' | null;

export default function OfferGratitude({
  offerId,
  offerTitle,
  limit = 3,           // initial number to show
}: {
  offerId: string;
  offerTitle?: string;
  limit?: number;
}) {
  const pageStep = 5; // how many to load each "Show more" click

  const [items, setItems] = useState<GratitudeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [source, setSource] = useState<Source>(null);
  const [total, setTotal] = useState<number>(0); // total rows available in the chosen source
  const [loaded, setLoaded] = useState<number>(0); // how many we’ve loaded so far

  const hasMore = useMemo(() => total > loaded, [total, loaded]);

  // ---- Mapping helpers -------------------------------------------------------
  function mapFromReviews(rows: any[]): GratitudeItem[] {
    return (rows || []).map((g: any) => ({
      id: g.id as string,
      created_at: g.created_at as string,
      text: (g.message as string) ?? '',
      author_name: g.receiver?.display_name ?? null,
      author_id: g.receiver_profile_id ?? null, // ← make name clickable
    }));
  }
  function mapFromNotifs(rows: any[]): GratitudeItem[] {
    return (rows || [])
      .map((n: any) => {
        const t = n?.data?.text ?? n?.data?.message ?? n?.data?.review ?? '';
        // Try several common keys for an author id in your payloads
        const pid =
          n?.data?.receiver_id ??
          n?.data?.sender_id ??
          n?.data?.author_id ??
          null;
        const name =
          n?.data?.receiver_name ??
          n?.data?.sender_name ??
          n?.data?.author_name ??
          null;
        return {
          id: n.id as string,
          created_at: n.created_at as string,
          text: t,
          author_name: name,
          author_id: pid,
        } as GratitudeItem;
      })
      .filter((g) => !!g.text?.trim());
  }

  // ---- Initial load: pick best available source + first page -----------------
  useEffect(() => {
    let cancelled = false;

    async function tryReviews(first: number) {
      // Try with `published` first; if column doesn’t exist, fall back without it
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
          .order('created_at', { ascending: false });

        if (withPublished) sel.eq('published', true);

        // 0..first-1
        sel.range(0, Math.max(first - 1, 0));

        const { data, error, count } = await sel;
        return { data, error, count: count ?? 0, withPublished };
      };

      // Attempt with published column
      const a = await run(true);
      // If “published” column is missing, PostgREST usually returns a clear error
      const missingPublished =
        a.error && String(a.error.message || '').toLowerCase().includes('column "published"');

      const b = missingPublished ? await run(false) : null;

      const pick = missingPublished ? b! : a;
      if (pick.error) throw pick.error;

      const rows = mapFromReviews(pick.data || []);
      return { rows, count: pick.count };
    }

    async function tryNotifications(first: number) {
      const { data, error, count } = await supabase
        .from('notifications')
        .select('id, created_at, type, data', { count: 'exact' })
        .contains('data', { offer_id: offerId })
        .order('created_at', { ascending: false })
        .range(0, Math.max(first - 1, 0));

      if (error) throw error;

      const rows = mapFromNotifs(data || []);
      return { rows, count: count ?? 0 };
    }

    async function init() {
      setLoading(true);
      setErr(null);

      try {
        // Prefer gratitude_reviews
        const r = await tryReviews(limit);
        if (!cancelled && r.count > 0) {
          setSource('gratitude_reviews');
          setItems(r.rows);
          setTotal(r.count);
          setLoaded(r.rows.length);
          setLoading(false);
          return;
        }
      } catch (e) {
        console.warn('[OfferGratitude] reviews failed, will fall back to notifications:', e);
      }

      // Fallback to notifications
      try {
        const n = await tryNotifications(limit);
        if (!cancelled) {
          setSource('notifications');
          setItems(n.rows);
          setTotal(n.count);
          setLoaded(n.rows.length);
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

  // ---- Pagination actions ----------------------------------------------------
  async function loadTo(newSize: number) {
    // Re-query from 0..newSize-1 to keep sort stable and avoid merging logic
    try {
      setLoading(true);
      if (source === 'gratitude_reviews') {
        // same two-step logic as initial load re: published column
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
      } else if (source === 'notifications') {
        const { data, error } = await supabase
          .from('notifications')
          .select('id, created_at, type, data')
          .contains('data', { offer_id: offerId })
          .order('created_at', { ascending: false })
          .range(0, Math.max(newSize - 1, 0));

        if (error) throw error;

        const rows = mapFromNotifs(data || []);
        setItems(rows);
        setLoaded(rows.length);
      }
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
      // total might be unknown (shouldn't happen with our queries),
      // but as a fallback, grab a big window.
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
              {new Date(g.created_at).toLocaleString()}
              {' '}
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

      {/* Controls */}
      {(hasMore || source === 'notifications') && (
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

      {/* Keep the deep link around as a secondary path */}
      {items.length >= limit && !hasMore && (
        <div className="mt-2">
          <Link
            href={`/profile/exchanges?tab=public&offer=${offerId}`}
            className="text-sm underline"
          >
            See more Gratitude Reviews
          </Link>
        </div>
      )}
    </div>
  );
}
