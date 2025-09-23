'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import OfferCard, { type OfferRow } from '@/components/OfferCard';

/** Keep offer_type strongly typed so filters are easy */
type OfferType = 'product' | 'service' | 'time' | 'knowledge' | 'other';

type DbOfferRow = {
  id: string;
  title: string;
  offer_type: OfferType;
  is_online: boolean;
  city: string | null;
  country: string | null;
  images: string[] | null;
  status: 'active' | 'paused' | 'archived' | 'blocked';
  created_at: string;
  // Supabase join shape
  offer_tags: { tags: { id: number; name: string } | null }[] | null;
};

export default function BrowseOffersPage() {
  const [rows, setRows] = useState<OfferRow[]>([]);
  const [loading, setLoading] = useState(true);

  // simple local filters (title/type/city/online)
  const [q, setQ] = useState('');
  const [type, setType] = useState<'all' | OfferType>('all');
  const [city, setCity] = useState('');
  const [onlineOnly, setOnlineOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from('offers')
        .select(`
          id, title, offer_type, is_online, city, country, images, status, created_at,
          offer_tags:offer_tags (
            tags:tags ( id, name )
          )
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (cancelled) return;

      if (error || !data) {
        console.error(error);
        setRows([]);
        setLoading(false);
        return;
      }

      // Normalize DB rows -> OfferRow (what <OfferCard/> wants)
      const mapped: OfferRow[] = (data as unknown as DbOfferRow[]).map((r) => ({
        id: r.id,
        title: r.title,
        offer_type: r.offer_type,
        is_online: r.is_online,
        city: r.city,
        country: r.country,
        images: r.images ?? null,
        tags: (r.offer_tags ?? [])
          .flatMap((ot) => (ot?.tags ? [ot.tags] : [])),
      }));

      setRows(mapped);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((o) => {
      if (type !== 'all' && o.offer_type !== type) return false;
      if (onlineOnly && !o.is_online) return false;
      if (city && (o.city || '').toLowerCase() !== city.toLowerCase()) return false;
      if (q && !o.title.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [rows, type, onlineOnly, city, q]);

  return (
    <section className="max-w-5xl">
      <h2 className="mb-3 text-2xl font-bold">Browse Offers</h2>

      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title…"
          className="rounded border px-3 py-2"
        />

        <select
          value={type}
          onChange={(e) => setType(e.target.value as 'all' | OfferType)}
          className="rounded border px-3 py-2"
        >
          <option value="all">all types</option>
          <option value="product">product</option>
          <option value="service">service</option>
          <option value="time">time</option>
          <option value="knowledge">knowledge</option>
          <option value="other">other</option>
        </select>

        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="City (optional)"
          className="rounded border px-3 py-2"
        />

        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onlineOnly}
            onChange={(e) => setOnlineOnly(e.target.checked)}
          />
          Online only
        </label>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : filtered.length === 0 ? (
        <p>No offers found.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filtered.map((o) => (
            <OfferCard key={o.id} offer={o} />
          ))}
        </div>
      )}
    </section>
  );
}
