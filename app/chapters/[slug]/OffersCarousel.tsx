'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

type OfferRow = {
  id: string;
  title: string;
  status: string;
  thumb_url: string | null;
  created_at: string;
};

export default function OffersCarousel({ groupId }: { groupId: string }) {
  const supabase = createClientComponentClient();
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase
        .from('offers')
        .select('id,title,status,thumb_url,created_at')
        .eq('group_id', groupId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(24);
      if (mounted) {
        if (error) console.error(error);
        setOffers(data ?? []);
      }
    })();
    return () => { mounted = false; };
  }, [groupId, supabase]);

  const visible = useMemo(() => {
    if (offers.length <= 3) return offers;
    return [0,1,2].map(i => offers[(index + i) % offers.length]);
  }, [offers, index]);

  if (!offers.length) return null;

  return (
    <section className="mt-6 rounded-2xl border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Chapter offers</h3>
        <a className="text-sm underline" href={`/offers?group=${groupId}`}>See all</a>
      </div>

      <div className="flex items-center gap-3">
        <button
          className="rounded-full border px-3 py-1"
          onClick={() => setIndex((p) => (p - 1 + offers.length) % offers.length)}
          aria-label="Previous"
        >‹</button>

        <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((o) => (
            <a key={o.id} href={`/offers/${o.id}`} className="group rounded-xl border p-3 hover:shadow-sm">
              <div className="flex items-center gap-3">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-neutral-100">
                  {o.thumb_url ? (
                    <Image src={o.thumb_url} alt="" fill className="object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-neutral-500">
                      No image
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-medium">{o.title}</div>
                  <div className="text-xs capitalize text-neutral-500">{o.status}</div>
                </div>
              </div>
            </a>
          ))}
        </div>

        <button
          className="rounded-full border px-3 py-1"
          onClick={() => setIndex((p) => (p + 1) % offers.length)}
          aria-label="Next"
        >›</button>
      </div>
    </section>
  );
}
