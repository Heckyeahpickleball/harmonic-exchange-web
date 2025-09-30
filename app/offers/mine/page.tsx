/* HX v0.7 — My Offers: owner status controls with optimistic UI + rollback
   File: app/offers/mine/page.tsx
*/
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import OfferCard, { type OfferRow } from '@/components/OfferCard';

type Status = 'active' | 'paused' | 'archived' | 'blocked' | 'pending';
type MyOffer = OfferRow & { status: Status };

const STATUS_FILTERS: Array<{ id: 'all' | Status; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'paused', label: 'Paused' },
  { id: 'archived', label: 'Archived' },
  { id: 'blocked', label: 'Blocked' },
  { id: 'pending', label: 'Pending' },
];

export default function MyOffersPage() {
  const [offers, setOffers] = useState<MyOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] =
    useState<(typeof STATUS_FILTERS)[number]>(STATUS_FILTERS[0]);
  const [msg, setMsg] = useState('');

  const visible = useMemo(
    () => (filter.id === 'all' ? offers : offers.filter((o) => o.status === filter.id)),
    [offers, filter.id]
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setOffers([]);
          return;
        }

        const { data, error } = await supabase
          .from('offers')
          .select(`
            id, title, offer_type, is_online, city, country, images, status,
            offer_tags(tag_id, tags:tags(id,name))
          `)
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const map = new Map<string, MyOffer>();
        for (const row of (data as any[]) ?? []) {
          const base: MyOffer =
            map.get(row.id) ??
            ({
              id: row.id,
              title: row.title,
              offer_type: row.offer_type,
              is_online: row.is_online,
              city: row.city,
              country: row.country,
              status: row.status as Status,
              images: row.images ?? [],
            } as MyOffer);

          const rowTags: { id: number; name: string }[] = (row.offer_tags ?? [])
            .map((r: any) => ({ id: r?.tag_id as number, name: r?.tags?.name as string }))
            .filter((t: { id: number; name: string }) => t.id && t.name);

          (base as any).tags = rowTags;
          map.set(row.id, base);
        }
        setOffers(Array.from(map.values()));
      } catch (e: any) {
        console.error(e?.message ?? e);
        setMsg(e?.message ?? 'Failed to load your offers.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function setStatus(id: string, next: Status) {
    setMsg('');
    // Remember previous for rollback
    const prev = offers.find((o) => o.id === id)?.status;

    // Optimistic UI
    setOffers((p) => p.map((o) => (o.id === id ? { ...o, status: next } : o)));

    try {
      const { error } = await supabase.from('offers').update({ status: next }).eq('id', id);
      if (error) throw error;
    } catch (e: any) {
      // Roll back UI and show real error message
      setOffers((p) => p.map((o) => (o.id === id && prev ? { ...o, status: prev } : o)));
      console.error(e?.message ?? e);
      setMsg(e?.message ?? 'Failed to update status.');
    }
  }

  function handleDeleted(id: string) {
    setOffers((prev) => prev.filter((o) => o.id !== id));
  }

  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-bold">My Offers</h1>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s.id}
            onClick={() => setFilter(s)}
            className={`rounded border px-3 py-1 text-sm ${
              filter.id === s.id ? 'bg-gray-900 text-white' : 'hover:bg-gray-50'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {msg && <p className="text-sm text-amber-700">{msg}</p>}

      {loading ? (
        <p>Loading…</p>
      ) : visible.length === 0 ? (
        <p>No offers yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {visible.map((o) => (
            <div key={o.id} className="space-y-2">
              {/* Card (shows View + Delete) */}
              <OfferCard offer={o} mine onDeleted={handleDeleted} />

              {/* Owner controls under the card (Edit / Pause / Archive / Unarchive) */}
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/offers/${o.id}/edit`}
                  className="rounded border px-2 py-1 text-sm hover:bg-gray-50"
                >
                  Edit
                </Link>

                {o.status === 'active' && (
                  <>
                    <button
                      onClick={() => setStatus(o.id, 'paused')}
                      className="rounded border px-2 py-1 text-sm hover:bg-gray-50"
                    >
                      Pause
                    </button>
                    <button
                      onClick={() => setStatus(o.id, 'archived')}
                      className="rounded border px-2 py-1 text-sm hover:bg-gray-50"
                    >
                      Archive
                    </button>
                  </>
                )}

                {o.status === 'paused' && (
                  <>
                    <button
                      onClick={() => setStatus(o.id, 'active')}
                      className="rounded border px-2 py-1 text-sm hover:bg-gray-50"
                    >
                      Resume
                    </button>
                    <button
                      onClick={() => setStatus(o.id, 'archived')}
                      className="rounded border px-2 py-1 text-sm hover:bg-gray-50"
                    >
                      Archive
                    </button>
                  </>
                )}

                {o.status === 'archived' && (
                  <button
                    onClick={() => setStatus(o.id, 'active')}
                    className="rounded border px-2 py-1 text-sm hover:bg-gray-50"
                  >
                    Unarchive (Resume)
                  </button>
                )}

                {o.status === 'blocked' && (
                  <span className="text-sm text-gray-600">Blocked</span>
                )}
                {o.status === 'pending' && (
                  <span className="text-sm text-gray-600">Pending approval</span>
                )}
              </div>

              <div className="text-xs text-gray-600">Status: {o.status}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
