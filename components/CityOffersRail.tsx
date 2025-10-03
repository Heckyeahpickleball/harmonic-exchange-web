'use client';

import Link from 'next/link';
import { useRef } from 'react';

export type CityOffer = {
  id: string;
  title: string;
  owner_display_name: string | null;
  thumb_url: string | null;
};

export default function CityOffersRail({
  offers,
  title = 'Local & online offerings',
  seeAllHref,
}: {
  offers: CityOffer[];
  title?: string;
  seeAllHref?: string;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);

  const scrollBy = (dx: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dx, behavior: 'smooth' });
  };

  // Smaller cards -> smaller step feels natural
  const STEP = 260;

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold">{title}</h3>
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
          className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full border bg-white/90 px-2 py-1 shadow"
        >
          ‹
        </button>
        <button
          aria-label="Next"
          onClick={() => scrollBy(STEP)}
          className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full border bg-white/90 px-2 py-1 shadow"
        >
          ›
        </button>

        <div
          ref={trackRef}
          className="no-scrollbar flex gap-3 overflow-x-auto scroll-smooth pr-6"
          style={{ scrollSnapType: 'x mandatory' }}
        >
          {offers.map((o) => {
            const img = o.thumb_url;
            return (
              <Link
                key={o.id}
                href={`/offers/${o.id}`}
                className="group w-[150px] flex-shrink-0 scroll-ml-4 scroll-snap-start"
              >
                <div className="rounded-xl border bg-white shadow-sm transition group-hover:shadow-md">
                  {/* 1:1 square thumbnail for consistent previews */}
                  <div className="relative aspect-square w-full overflow-hidden rounded-t-xl bg-neutral-100">
                    {img ? (
                      <img
                        src={img}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
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
                      <span className="hx-btn hx-btn--primary inline-block text-[11px] px-2 py-1">Ask to Receive</span>
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
