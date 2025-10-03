'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

type Offer = {
  id: string;
  title: string | null;
  images?: string[] | null;
  cover_image?: string | null;
  created_at: string;
};

export default function OffersCarousel({ groupId }: { groupId: string }) {
  const supabase = createClientComponentClient();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [i, setI] = useState(0);

  function isStoragePath(s: string) { return !!s && !/^https?:\/\//i.test(s); }
  function publicUrlFor(path: string) {
    const a = supabase.storage.from('offer-images').getPublicUrl(path).data.publicUrl;
    const b = supabase.storage.from('post-media').getPublicUrl(path).data.publicUrl;
    return a || b;
  }
  const thumbFor = (o: Offer) => {
    const cand = o.cover_image ?? (o.images?.[0] ?? null);
    if (!cand) return null;
    return isStoragePath(cand) ? publicUrlFor(cand) : cand;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('offers')
        .select('id,title,images,cover_image,created_at')
        .eq('group_id', groupId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(20);
      if (!cancelled && data) setOffers(data);
    })();
    return () => { cancelled = true; };
  }, [groupId, supabase]);

  const active = offers[i] ?? null;
  const activeThumb = useMemo(() => (active ? thumbFor(active) : null), [active]);

  if (!offers.length) return null;

  return (
    <div className="mt-6 rounded-2xl border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Local offerings</h3>
        <div className="space-x-2">
          <button onClick={() => setI((p) => (p === 0 ? offers.length - 1 : p - 1))} className="rounded-full border px-3 py-1">‹</button>
          <button onClick={() => setI((p) => (p === offers.length - 1 ? 0 : p + 1))} className="rounded-full border px-3 py-1">›</button>
          <a href={`/browse?group=${encodeURIComponent(groupId)}`} className="ml-2 rounded-full border px-3 py-1">
            See all
          </a>
        </div>
      </div>

      <div className="grid grid-cols-[96px_1fr] gap-4 items-center">
        <div className="relative h-24 w-24 overflow-hidden rounded-lg border bg-white">
          {activeThumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={activeThumb} alt={active?.title ?? 'Offer image'} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">No image</div>
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate text-base font-medium">{active?.title ?? 'Untitled offer'}</div>
          <div className="mt-1 text-sm text-gray-500">
            {i + 1} / {offers.length}
          </div>
        </div>
      </div>
    </div>
  );
}
