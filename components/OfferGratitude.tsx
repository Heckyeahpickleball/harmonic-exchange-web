'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type GratitudeItem = {
  id: string;
  created_at: string;
  text: string;
  author_name?: string | null; // the receiver who wrote the thank-you
};

export default function OfferGratitude({
  offerId,
  offerTitle,            // ← NEW: for the heading
  limit = 3,
}: {
  offerId: string;
  offerTitle?: string;
  limit?: number;
}) {
  const [items, setItems] = useState<GratitudeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);

      // --- 1) Primary source: gratitude_reviews ---
      try {
        const { data, error } = await supabase
          .from('gratitude_reviews')
          .select(`
            id,
            created_at,
            message,
            published,
            offer_id,
            receiver_profile_id,
            receiver:profiles!gratitude_reviews_receiver_profile_id_fkey(display_name)
          `)
          .eq('offer_id', offerId)
          .eq('published', true)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error && String(error.message || '').toLowerCase().includes('column "published"')) {
          const { data: data2, error: error2 } = await supabase
            .from('gratitude_reviews')
            .select(`
              id,
              created_at,
              message,
              offer_id,
              receiver_profile_id,
              receiver:profiles!gratitude_reviews_receiver_profile_id_fkey(display_name)
            `)
            .eq('offer_id', offerId)
            .order('created_at', { ascending: false })
            .limit(limit);

          if (error2) throw error2;

          const mapped2: GratitudeItem[] =
            (data2 || []).map((g: any) => ({
              id: g.id as string,
              created_at: g.created_at as string,
              text: (g.message as string) ?? '',
              author_name: g.receiver?.display_name ?? null,
            })) ?? [];

          if (!cancelled && mapped2.length) {
            setItems(mapped2);
            setLoading(false);
            return;
          }
        } else if (error) {
          throw error;
        } else {
          const mapped: GratitudeItem[] =
            (data || []).map((g: any) => ({
              id: g.id as string,
              created_at: g.created_at as string,
              text: (g.message as string) ?? '',
              author_name: g.receiver?.display_name ?? null,
            })) ?? [];

          if (!cancelled && mapped.length) {
            setItems(mapped);
            setLoading(false);
            return;
          }

          // minimal fallback without join
          if (!cancelled && mapped.length === 0) {
            const { data: plain, error: plainErr } = await supabase
              .from('gratitude_reviews')
              .select('id, created_at, message')
              .eq('offer_id', offerId)
              .order('created_at', { ascending: false })
              .limit(limit);

            if (plainErr) throw plainErr;

            const mappedPlain: GratitudeItem[] =
              (plain || []).map((g: any) => ({
                id: g.id as string,
                created_at: g.created_at as string,
                text: (g.message as string) ?? '',
                author_name: null,
              })) ?? [];

            if (!cancelled && mappedPlain.length) {
              setItems(mappedPlain);
              setLoading(false);
              return;
            }
          }
        }
      } catch (e) {
        // Fall through to notifications
        console.warn('[OfferGratitude] gratitude_reviews query failed/empty, falling back:', e);
      }

      // --- 2) Fallback: notifications produced when a gratitude was posted ---
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('id, created_at, type, data')
          .contains('data', { offer_id: offerId })
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) throw error;

        const mapped: GratitudeItem[] =
          (data || [])
            .map((n: any) => {
              const t =
                n?.data?.text ??
                n?.data?.message ??
                n?.data?.review ??
                '';
              return {
                id: n.id as string,
                created_at: n.created_at as string,
                text: t,
                author_name:
                  n?.data?.receiver_name ??
                  n?.data?.sender_name ??
                  n?.data?.author_name ??
                  null,
              } as GratitudeItem;
            })
            .filter((g: GratitudeItem) => !!g.text?.trim()) ?? [];

        if (!cancelled) setItems(mapped);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? 'Could not load reviews.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [offerId, limit]);

  if (loading) return null;
  if (err) return null;
  if (!items.length) return null;

  return (
    <div className="mt-4">
      <h3 className="mb-2 text-lg font-semibold">
        {/* requested copy change */}
        {`Recent Gratitude for ${offerTitle ?? 'this offer'}`}
      </h3>
      <ul className="space-y-2">
        {items.map((g) => (
          <li key={g.id} className="rounded border p-3">
            <div className="text-xs text-gray-500">
              {new Date(g.created_at).toLocaleString()}
              {g.author_name ? ` • from ${g.author_name}` : ''}
            </div>
            <div className="mt-1 whitespace-pre-wrap text-sm">{g.text}</div>
          </li>
        ))}
      </ul>

      {items.length >= limit && (
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
