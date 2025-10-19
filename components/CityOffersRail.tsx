// /components/CityOffersRail.tsx
'use client';

import Link from 'next/link';
import { useMemo, useRef } from 'react';

export type CityOffer = {
  id: string;
  title: string;
  owner_display_name: string | null;
  thumb_url: string | null;

  // May be present if your query selected location columns
  area_city?: string | null;
  area_country?: string | null;
};

export default function CityOffersRail({
  offers,
  title = 'Local offerings',
  seeAllHref,
  // When provided, we strictly filter by city (and optionally country)
  city,
  country,
  // Allow “Online/Virtual/Remote” items only if explicitly requested
  includeOnline = false,
}: {
  offers: CityOffer[];
  title?: string;
  seeAllHref?: string;
  city?: string;
  country?: string;
  includeOnline?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);

  const scrollBy = (dx: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dx, behavior: 'smooth' });
  };

  const STEP = 260;

  // ---- helpers --------------------------------------------------------------
  const normalize = (s?: string | null) => (s ?? '').trim().toLowerCase();
  const isOnlineLabel = (s?: string | null) => {
    const v = normalize(s);
    return v === '' || v === 'online' || v === 'virtual' || v === 'remote';
  };

  // If no explicit city is passed, try to infer one from the data.
  // We ignore online/blank and pick the most frequent non-online city,country pair.
  const inferred = useMemo(() => {
    if (!offers?.length) return { city: '', country: '', confidence: 0 };

    const counts = new Map<string, number>(); // key: "city||country"
    for (const o of offers) {
      const oc = normalize(o.area_city);
      const oco = normalize(o.area_country);
      if (isOnlineLabel(oc)) continue;
      if (!oc) continue; // skip blanks
      const key = `${oc}||${oco}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    if (!counts.size) return { city: '', country: '', confidence: 0 };

    // find the dominant pair
    let topKey = '';
    let topCount = 0;
    let total = 0;
    for (const [k, v] of counts) {
      total += v;
      if (v > topCount) {
        topCount = v;
        topKey = k;
      }
    }
    const [cCity, cCountry] = topKey.split('||');
    const confidence = total > 0 ? topCount / total : 0;

    return { city: cCity, country: cCountry, confidence };
  }, [offers]);

  // Decide the effective city/country for filtering:
  // 1) If props provided, use them.
  // 2) Otherwise, if we can infer a dominant city (>=60% of non-online items), use that.
  // 3) Otherwise, no city-level filtering is applied (backward compatible).
  const effectiveCity = useMemo(() => {
    const explicit = normalize(city);
    if (explicit) return explicit;
    if (inferred.confidence >= 0.6 && inferred.city) return inferred.city;
    return '';
  }, [city, inferred]);

  const effectiveCountry = useMemo(() => {
    const explicit = normalize(country);
    if (explicit) return explicit;
    if (inferred.confidence >= 0.6) return inferred.country;
    return '';
  }, [country, inferred]);

  // ---- filtering logic (safe + backward compatible) -------------------------
  const filtered = useMemo(() => {
    const cCity = effectiveCity;
    const cCountry = effectiveCountry;

    // If we still have no effective city, keep previous behavior:
    // return as-is (but let callers set city/includeOnline to tighten).
    if (!cCity) return offers;

    return offers.filter((o) => {
      const oc = normalize(o.area_city);
      const oco = normalize(o.area_country);

      // Exclude online/blank unless explicitly allowed
      if (!includeOnline && isOnlineLabel(oc)) return false;

      // Must match city
      if (oc !== cCity) return false;

      // If a country is available, it must also match (when present)
      if (cCountry && oco !== cCountry) return false;

      return true;
    });
  }, [offers, effectiveCity, effectiveCountry, includeOnline]);

  return (
    <div className="mt-1">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-bold">{title}</h3>
        {seeAllHref && (
          <Link href={seeAllHref} className="text-sm underline underline-offset-2">
            See all
          </Link>
        )}
      </div>

      <div className="relative">
        <button
          aria-label="Previous"
          onClick={() => scrollBy(-STEP)}
          className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full border bg-white/90 px-2 py-1 shadow hover:bg-white"
        >
          ‹
        </button>
        <button
          aria-label="Next"
          onClick={() => scrollBy(STEP)}
          className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full border bg-white/90 px-2 py-1 shadow hover:bg-white"
        >
          ›
        </button>

        <div
          ref={trackRef}
          className="no-scrollbar flex gap-3 overflow-x-auto scroll-smooth pr-6"
          style={{ scrollSnapType: 'x mandatory' }}
        >
          {filtered.map((o) => {
            const img = o.thumb_url;
            return (
              <Link
                key={o.id}
                href={`/offers/${o.id}`}
                className="group w-[150px] flex-shrink-0 scroll-ml-4 scroll-snap-start focus:outline-none"
              >
                <div className="rounded-xl border bg-white shadow-sm transition duration-200 group-hover:shadow-lg">
                  {/* Fixed 150x150 square thumbnail with brand ring & hover zoom */}
                  <div
                    className="
                      relative w-full h-[150px] overflow-hidden rounded-t-xl bg-neutral-100
                      ring-1 ring-emerald-700/25 transition
                      group-hover:ring-emerald-700/55 group-focus:ring-emerald-700/55
                      focus-within:ring-emerald-700/55
                    "
                  >
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img}
                        alt=""
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[11px] text-gray-400">
                        No image
                      </div>
                    )}
                  </div>

                  <div className="p-2">
                    <div className="line-clamp-1 font-medium text-[13px]">{o.title}</div>
                    <div className="mt-1 line-clamp-1 text-[11px] text-gray-600">
                      {o.owner_display_name ? `by ${o.owner_display_name}` : ''}
                    </div>
                    <div className="mt-2">
                      <span className="hx-btn hx-btn--primary inline-block text-[11px] px-2 py-1">
                        Ask to Receive
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
