// /app/offers/page.tsx
'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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
  const [err, setErr] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);

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
      .catch((e) => {
        console.error(e);
        setWarn('Could not load tags (showing all offers without tag filter).');
      });
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

  // Build the base offers query WITHOUT joins (joins can be blocked by RLS for public users)
  function baseOffersQuery() {
    let qb = supabase
      .from('offers')
      .select(
        [
          'id',
          'title',
          'offer_type',
          'is_online',
          'city',
          'country',
          'images',
          'status',
          'created_at',
          'owner_id',
        ].join(',')
      )
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(500);

    if (type !== 'all types') qb = qb.eq('offer_type', type);
    if (onlineOnly) qb = qb.eq('is_online', true);
    if (!onlineOnly && city.trim()) qb = qb.ilike('city', `%${city.trim()}%`);

    return qb;
  }

  // Helper: get offer IDs that have ALL selected tagIds
  async function filterIdsByAllTags(ids: number[]): Promise<string[]> {
    if (!ids.length) return [];

    try {
      const { data, error } = await supabase
        .from('offer_tags')
        .select('offer_id, tag_id')
        .in('tag_id', ids)
        .limit(10000);

      if (error) throw error;

      // Count tags per offer_id and require all selected ids to be present
      const byOffer = new Map<string, Set<number>>();
      for (const row of (data || []) as any[]) {
        const k = row.offer_id as string;
        const t = row.tag_id as number;
        if (!byOffer.has(k)) byOffer.set(k, new Set());
        byOffer.get(k)!.add(t);
      }
      const result: string[] = [];
      const need = new Set(ids);
      for (const [offerId, got] of byOffer) {
        let ok = true;
        for (const needId of need) {
          if (!got.has(needId)) {
            ok = false;
            break;
          }
        }
        if (ok) result.push(offerId);
      }
      return result;
    } catch (e) {
      console.warn('Tag filter disabled due to RLS or error:', e);
      setWarn('Tag filtering unavailable right now (showing results without tag filter).');
      return [];
    }
  }

  // --- Load offers whenever filters change
  async function load() {
    setLoading(true);
    setErr(null);
    setWarn(null);
    try {
      const qTrim = q.trim();
      const like = `%${qTrim}%`;

      // 0) If tag filter is on, compute set of offer IDs that match ALL tags
      let restrictToIds: string[] | null = null;
      if (tagIds.length) {
        const ids = await filterIdsByAllTags(tagIds);
        // If we could not read offer_tags (RLS) we just skip tag filtering gracefully
        restrictToIds = ids.length ? ids : [];
        // If result is an empty array, no offers match; short-circuit
        if (restrictToIds.length === 0) {
          setOffers([]);
          setPage(1);
          setLoading(false);
          return;
        }
      }

      // 1) Title search (or all)
      let qb = baseOffersQuery();
      if (restrictToIds) qb = qb.in('id', restrictToIds);
      if (qTrim) qb = qb.ilike('title', like);
      const { data: byTitleRows, error: byTitleErr } = await qb;
      if (byTitleErr) throw byTitleErr;

      // 2) Optional owner-name search (best-effort; ignore if blocked by RLS)
      let byOwnerRows: any[] = [];
      if (qTrim) {
        try {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id')
            .ilike('display_name', like)
            .limit(100);

          const ownerIds = (profs || []).map((p: any) => p.id);
          if (ownerIds.length) {
            let qb2 = baseOffersQuery().in('owner_id', ownerIds);
            if (restrictToIds) qb2 = qb2.in('id', restrictToIds);
            const { data: ownerData } = await qb2;
            byOwnerRows = ownerData || [];
          }
        } catch (e) {
          // If profiles is protected, just skip owner search
          console.warn('Owner search skipped due to RLS:', e);
        }
      }

      // Merge + de-dupe
      const allRows = ([] as any[]).concat(byTitleRows || [], byOwnerRows || []);
      const seen = new Set<string>();
      const cleaned: OfferRow[] = [];
      for (const o of allRows) {
        if (seen.has(o.id)) continue;
        seen.add(o.id);
        cleaned.push({
          id: o.id,
          title: o.title ?? 'Untitled offer',
          offer_type: o.offer_type ?? 'other',
          is_online: !!o.is_online,
          city: o.city ?? null,
          country: o.country ?? null,
          status: o.status ?? 'active',
          images: Array.isArray(o.images) ? o.images : o.images ? [o.images] : [],
          created_at: o.created_at,
          // OfferCard ignores missing owner name; we’re not joining profiles here.
        } as OfferRow);
      }

      setOffers(cleaned);
      setPage(1);
    } catch (e: any) {
      console.error('[BrowseOffers] load error:', e);
      const msg =
        e?.message ||
        e?.error?.message ||
        e?.details ||
        (typeof e === 'string' ? e : '') ||
        'Failed to load offers.';
      setErr(msg);
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
      <div className="mb-1 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Browse Offers</h1>
        <Link
          href="/offers/new"
          className="inline-flex items-center justify-center rounded-full bg-[var(--hx-brand)] text-white px-4 py-2 text-sm font-semibold shadow hover:opacity-95 active:opacity-90 whitespace-nowrap"
        >
          New Offer
        </Link>
      </div>

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

      {/* Messages */}
      {err && (
        <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {err}
        </p>
      )}
      {warn && !err && (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {warn}
        </p>
      )}

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
