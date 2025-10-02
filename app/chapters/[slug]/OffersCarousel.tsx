'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

type Offer = {
  id: string;
  title: string | null;
  images?: string[] | null;
};

export default function OffersCarousel({ groupId }: { groupId: string }) {
  const supabase = createClientComponentClient();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [i, setI] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('offers')
        .select('id,title,images')
        .eq('group_id', groupId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(12);

      if (!cancelled && !error && data) {
        setOffers(data);
      }
    })();
    return () => { cancelled = true; };
  }, [groupId, supabase]);

  if (!offers.length) return null;

  const prev = () => setI((p) => (p === 0 ? offers.length - 1 : p - 1));
  const next = () => setI((p) => (p === offers.length - 1 ? 0 : p + 1));

  const active = offers[i];

  return (
    <div className="mt-6 rounded-2xl border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Chapter offerings</h3>
        <div className="space-x-2">
          <button onClick={prev} className="rounded-full border px-3 py-1">‹</button>
          <button onClick={next} className="rounded-full border px-3 py-1">›</button>
          <a href="/exchange?scope=local" className="ml-2 rounded-full border px-3 py-1">
            See all
          </a>
        </div>
      </div>

      <div className="grid grid-cols-[96px_1fr] gap-4 items-center">
        <div className="relative h-24 w-24 overflow-hidden rounded-lg border bg-white">
          {active?.images?.[0] ? (
            <Image
              src={active.images[0]}
              alt={active.title ?? 'Offer image'}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
              No image
            </div>
          )}
        </div>
        <div className="truncate">
          <div className="text-base font-medium">{active.title ?? 'Untitled offer'}</div>
          <div className="mt-1 text-sm text-gray-500">
            {i + 1} / {offers.length}
          </div>
        </div>
      </div>
    </div>
  );
}
