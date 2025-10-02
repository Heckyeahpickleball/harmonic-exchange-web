'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

type OfferRow = {
  id: string;
  title: string;
  thumb_url: string | null;
  status: string;
};

export default function OffersCarousel({ groupId }: { groupId: string }) {
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [i, setI] = useState(0);
  const supabase = createClientComponentClient();

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase
        .from('offers')
        .select('id,title,thumb_url,status')
        .eq('group_id', groupId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(20);
      if (!mounted) return;
      if (error) { console.error(error); return; }
      setOffers(data || []);
    })();
    return () => { mounted = false; };
  }, [groupId, supabase]);

  if (!offers.length) return null;

  const advance = (d: number) => {
    setI((prev) => (prev + d + offers.length) % offers.length);
  };

  return (
    <div className="mt-4 rounded-2xl border p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Chapter offers</h3>
        <a href={`/offers?group=${groupId}`} className="text-sm underline">See all</a>
      </div>

      <div className="relative flex items-center gap-3">
        <button
          className="rounded-full border px-3 py-1"
          onClick={() => advance(-1)}
          aria-label="Previous"
        >
          ‹
        </button>

        <div className="flex-1 overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {offers.slice(i, i + 3).map((o) => (
              <a key={o.id} href={`/offers/${o.id}`} className="block rounded-xl border p-3 hover:shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="relative h-12 w-12 shrink-0 rounded-md bg-neutral-100 overflow-hidden">
                    {o.thumb_url ? (
                      <Image src={o.thumb_url} alt="" fill className="object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-xs text-neutral-500">No image</div>
                    )}
                  </div>
                  <div className="truncate">
                    <div className="truncate font-medium">{o.title}</div>
                    <div className="text-xs text-neutral-500 capitalize">{o.status}</div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>

        <button
          className="rounded-full border px-3 py-1"
          onClick={() => advance(+1)}
          aria-label="Next"
        >
          ›
        </button>
      </div>
    </div>
  );
}
