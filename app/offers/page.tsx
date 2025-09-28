// /app/offers/page.tsx
'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import OfferCard, { type OfferRow } from '@/components/OfferCard';
import TagMultiSelect from '@/components/TagMultiSelect';
import { fetchAllTags, type Tag } from '@/lib/tags';

const TYPES = ['all types', 'product', 'service', 'time', 'knowledge', 'other'] as const;
type TypeFilter = (typeof TYPES)[number];

export default function Page() {
  return (
    <Suspense fallback={<section className="p-4 text-sm text-gray-600">Loading…</section>}>
      <BrowseOffersPage />
    </Suspense>
  );
}

function BrowseOffersPage() {
  const sp = useSearchParams();
  const router = useRouter();

  // --- UI state (from URL on first render)
  const [qInput, setQInput] = useState(sp.get('q') ?? '');
  const [q, setQ] = useState(sp.get('q') ?? '');
  const [type, setType] = useState<TypeFilter>((sp.get('type') as TypeFilter) || 'all types');
  const [city, setCity] = useState(sp.get('city') ?? '');
  const [onlineOnly, setOnlineOnly] = useState(sp.get('online') === '1');

  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);

  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [loading, setLoading] = useState(false);

  // pagination (client-side)
  const PAGE_SIZE = 12;
  const [page, setPage] = useState<number>(parseInt(sp.get('page') || '1', 10) || 1);

  // --- Load all tags first
  useEffect(() => {
    fetchAllTags()
      .then((tags) => {
        setAllTags(tags);
        // initialize selected tags from URL: ?tags=1,4,20
        const csv = sp.get('tags');
        if (csv) {
          const ids = csv
            .split(',')
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => Number.isFinite(n) && n > 0);
          const found = tags.filter((t) => ids.includes(t.id));
          setSelectedTags(found);
        }
      })
      .catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Debounce text search
  useEffect(() => {
    const t = setTimeout(() => setQ(qInput), 250);
    return () => clearTimeout(t);
  }, [qInput]);

  // --- Keep URL in sync
  useEffect(() => {
    const params = new URLSearchParams();

    if (q.trim()) params.set('q', q.trim());
    if (type !== 'all types') params.set('type', type);
    if (city.trim()) params.set('city', city.trim());
    if (onlineOnly) params.set('online', '1');
    if (selectedTags.length) params.set('tags', selectedTags.map((t) => t.id).join(','));
    if (page > 1) params.set('page', String(page));

    const qs = params.toString();
    router.replace(`/offers${qs ? `?${qs}` : ''}`);
  }, [q, type, city, onlineOnly, selectedTags, page, router]);

  const tagIds = useMemo(() => selectedTags.map((t) => t.id).filter((id) => id > 0), [selectedTags]);

  // Helper: build base query (used for title search and owner search)
  function makeBaseQuery() {
    const tagJoin = tagIds.length ? 'offer_tags!inner' : 'offer_tags';
    let qb = supabase
      .from('offers')
      .select(
        `
        id,
        title,
        offer_type,
        is_online,
        city,
        country,
        images,
        status,
        created_at,
        owner_id,
        profiles!inner ( id, display_name ),
        ${tagJoin} ( tag_id, tags(name) )
      `
      )
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(500);

    if (type !== 'all types') qb = qb.eq('offer_type', type);
    if (onlineOnly) qb = qb.eq('is_online', true);
    if (!onlineOnly && city.trim()) qb = qb.ilike('city', `%${city.trim()}%`);
    if (tagIds.length) qb = qb.in('offer_tags.tag_id', tagIds);

    return qb;
  }

  // --- Load offers whenever filters change
  async function load() {
    setLoading(true);
    try {
      const qTrim = q.trim();
      const like = `%${qTrim}%`;

      // 1) Title search (or all active if no q)
      const titleQB = makeBaseQuery();
      const byTitle = await (qTrim ? titleQB.ilike('title', like) : titleQB);

      // 2) Owner search: find matching profile IDs then fetch offers by owner_id
      let byOwnerData: any[] = [];
      if (qTrim) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id')
          .ilike('display_name', like)
          .limit(100);

        const ownerIds = ((profs || []) as { id: string }[]).map((p) => p.id);
        if (ownerIds.length) {
          const ownerQB = makeBaseQuery().in('owner_id', ownerIds);
          const byOwner = await ownerQB;
          byOwnerData = (byOwner?.data as any[]) || [];
        }
      }

      const rows = ([] as any[]).concat((byTitle?.data as any[]) || [], byOwnerData);

      // De-dupe by offer id and collect tags
      const map = new Map<
        string,
        OfferRow & { tags?: { id: number; name: string }[]; owner_id?: string; owner_name?: string }
      >();

      for (const row of rows) {
        const base =
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
            created_at: row.created_at,
            owner_id: row.owner_id,
            owner_name: row.profiles?.display_name ?? '—',
            tags: [],
          } as OfferRow & { tags?: { id: number; name: string }[]; owner_id?: string; owner_name?: string });

        const rowTags: { id: number; name: string }[] = (row.offer_tags ?? [])
          .map((ot: any) => ({ id: ot?.tag_id as number, name: ot?.tags?.name as string }))
          .filter((t: { id: number; name: string }) => t.id && t.name);

        for (const t of rowTags) {
          if (!base.tags!.some((x) => x.id === t.id)) base.tags!.push(t);
        }
        map.set(row.id, base);
      }

      setOffers(Array.from(map.values()));
      setPage(1);
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

  // --- Client-side pagination slice
  const pageCount = Math.max(1, Math.ceil(offers.length / PAGE_SIZE));
  const pageSafe = Math.min(Math.max(page, 1), pageCount);
  const visible = offers.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-bold">Browse Offers</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          placeholder="Search title or owner…"
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

      {/* Results */}
      {loading ? (
        <p>Loading…</p>
      ) : offers.length === 0 ? (
        <p>No offers found.</p>
      ) : (
        <>
          <div className="text-sm text-gray-600">{offers.length} result(s)</div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {visible.map((o) => (
              <OfferCard key={o.id} offer={o} />
            ))}
          </div>

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                disabled={pageSafe <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Prev
              </button>
              <span className="text-sm">
                Page {pageSafe} / {pageCount}
              </span>
              <button
                className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                disabled={pageSafe >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
