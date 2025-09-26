// app/offers/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import OfferCard, { type OfferRow } from '@/components/OfferCard';
import TagMultiSelect from '@/components/TagMultiSelect';
import { fetchAllTags, type Tag } from '@/lib/tags';

const TYPES = ['all types', 'product', 'service', 'time', 'knowledge', 'other'] as const;
type TypeFilter = (typeof TYPES)[number];

export default function BrowseOffersPage() {
  const [q, setQ] = useState('');
  const [type, setType] = useState<TypeFilter>('all types');
  const [city, setCity] = useState('');
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAllTags().then(setAllTags).catch(console.error);
  }, []);

  const tagIds = useMemo(
    () => selectedTags.filter((t) => t.id > 0).map((t) => t.id),
    [selectedTags]
  );

  async function load() {
    setLoading(true);
    try {
      const join = tagIds.length ? 'offer_tags!inner' : 'offer_tags';
      let query = supabase
        .from('offers')
        .select(
          `id,title,offer_type,is_online,city,country,images, ${join}(tag_id,tags(name))`
        )
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (q.trim()) query = query.ilike('title', `%${q.trim()}%`);
      if (type !== 'all types') query = query.eq('offer_type', type);
      if (onlineOnly) query = query.eq('is_online', true);
      if (!onlineOnly && city.trim()) query = query.ilike('city', `%${city.trim()}%`);
      if (tagIds.length) query = query.in('offer_tags.tag_id', tagIds);

      const { data, error } = await query;
      if (error) throw error;

      // De-dupe when inner-joining tags
      const map = new Map<string, OfferRow>();
      for (const row of ((data as any[]) ?? [])) {
        const existing =
          map.get(row.id) ??
          ({
            id: row.id,
            title: row.title,
            offer_type: row.offer_type,
            is_online: row.is_online,
            city: row.city,
            country: row.country,
            status: row.status ?? 'active',
            images: row.images ?? [],
          } as OfferRow);

        const rowTags: { id: number; name: string }[] = (row.offer_tags ?? [])
          .map((ot: any) => ({ id: ot?.tag_id as number, name: ot?.tags?.name as string }))
          .filter((t: { id: number; name: string }) => t.id && t.name);

        // merge unique by id (for local tag display, not OfferRow)
        const mergedTags = rowTags.reduce(
          (acc: { id: number; name: string }[], t: { id: number; name: string }) =>
            acc.some((x) => x.id === t.id) ? acc : acc.concat(t),
          []
        );
        // Attach tags to a parallel map for display if needed, or extend OfferRow elsewhere if required
        (existing as any).tags = mergedTags;
        map.set(row.id, existing);
      }
      setOffers(Array.from(map.values()));
    } catch (e) {
      console.error(e);
      setOffers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, type, city, onlineOnly, tagIds.join(',')]);

  const filtered = offers; // all server filtering already applied

  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-bold">Browse Offers</h1>

      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title…"
          className="rounded border px-3 py-2"
        />

        <select
          value={type}
          onChange={(e) => setType(e.target.value as TypeFilter)}
          className="rounded border px-3 py-2"
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
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

      <TagMultiSelect
        allTags={allTags}
        value={selectedTags}
        onChange={setSelectedTags}
        placeholder="Filter by tag(s)"
      />

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
