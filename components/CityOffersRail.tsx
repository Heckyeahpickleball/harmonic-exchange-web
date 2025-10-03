'use client';

import { useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export type CityOffer = {
  id: string;
  title: string;
  owner_display_name?: string | null;
  thumb_url?: string | null;
};

export default function CityOffersRail({
  offers,
  seeAllHref,
  title = 'Local offers',
}: {
  offers: CityOffer[];
  seeAllHref: string;
  title?: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);

  const scrollBy = (delta: number) => {
    if (!scroller.current) return;
    scroller.current.scrollBy({ left: delta, behavior: 'smooth' });
  };

  if (!offers?.length) return null;

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">{title}</h3>
        <Link
          href={seeAllHref}
          className="text-sm underline hover:no-underline"
        >
          See all
        </Link>
      </div>

      <div className="relative">
        <button
          aria-label="Scroll left"
          onClick={() => scrollBy(-320)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full shadow bg-white/90 hover:bg-white"
        >
          ‹
        </button>
        <div
          ref={scroller}
          className="flex gap-3 overflow-x-auto no-scrollbar scroll-smooth pr-10 pl-10"
        >
          {offers.map((o) => (
            <Link
              key={o.id}
              href={`/offers/${o.id}`}
              className="min-w-[280px] max-w-[280px] rounded-xl border bg-white hover:shadow-sm transition"
            >
              <div className="aspect-[3/2] w-full relative rounded-t-xl overflow-hidden bg-neutral-100">
                {o.thumb_url ? (
                  <Image
                    src={o.thumb_url}
                    alt={o.title}
                    fill
                    className="object-cover"
                    sizes="280px"
                  />
                ) : null}
              </div>
              <div className="p-3">
                <div className="text-sm font-medium line-clamp-2">{o.title}</div>
                {o.owner_display_name ? (
                  <div className="mt-1 text-xs text-neutral-500">
                    by {o.owner_display_name}
                  </div>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
        <button
          aria-label="Scroll right"
          onClick={() => scrollBy(320)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full shadow bg-white/90 hover:bg-white"
        >
          ›
        </button>
      </div>
    </section>
  );
}
