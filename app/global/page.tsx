'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import CityOffersRail, { CityOffer } from '@/components/CityOffersRail';
import PostItem from '@/components/PostItem';

type FeedPost = {
  id: string;
  profile_id: string;
  body: string | null;
  created_at: string;
  images?: string[] | null;
  profiles?: { display_name: string | null } | null;
};

export default function GlobalExchangePage() {
  const [offers, setOffers] = useState<CityOffer[] | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // OFFERS: all active (local + online), newest first, de-duped
        const { data: oRows } = await supabase
          .from('offers')
          .select('id,title,images,owner_id,created_at,status')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(64);

        const merged = (oRows || []) as any[];

        const ownerIds = Array.from(new Set(merged.map((r: any) => r.owner_id)));
        const { data: owners } = ownerIds.length
          ? await supabase.from('profiles').select('id,display_name').in('id', ownerIds)
          : { data: [] as any[] };
        const nameById = new Map<string, string | null>();
        for (const p of (owners || []) as any[]) nameById.set(p.id, p.display_name ?? null);

        function isStoragePath(s: string) {
          return !!s && !/^https?:\/\//i.test(s);
        }
        function publicUrlForPath(path: string) {
          return supabase.storage.from('post-media').getPublicUrl(path).data.publicUrl;
        }

        const list: CityOffer[] = merged.map((row: any) => {
          const imgs = Array.isArray(row.images) ? row.images : [];
          const first = imgs.length ? imgs[0] : null;
          const thumb_url = first ? (isStoragePath(first) ? publicUrlForPath(first) : String(first)) : null;
          return {
            id: row.id,
            title: row.title ?? 'Untitled offer',
            owner_display_name: nameById.get(row.owner_id) ?? null,
            thumb_url,
          };
        });

        if (!cancelled) setOffers(list);

        // POSTS: latest across everything (chapter/global), newest first
        const { data: pRows } = await supabase
          .from('posts')
          .select('id,profile_id,body,created_at,images,profiles(display_name)')
          .order('created_at', { ascending: false })
          .limit(50);

        function normalizeProfile<T extends { profiles?: any }>(row: T) {
          const p = (row as any).profiles;
          return { ...row, profiles: Array.isArray(p) ? (p?.[0] ?? null) : p ?? null };
        }
        function normalizeImageList(arr: any): string[] {
          if (!arr) return [];
          if (Array.isArray(arr)) return arr.map(String);
          return [String(arr)];
        }

        const pList: FeedPost[] = (pRows || []).map((row: any) =>
          normalizeProfile({
            ...row,
            images: normalizeImageList(row.images),
          })
        );

        if (!cancelled) setPosts(pList);
      } catch (e: any) {
        console.error(e);
        if (!cancelled) setMsg(e?.message ?? 'Failed to load Global Exchange.');
      }
    })();
    return () => {
      // nothing to clean
    };
  }, []);

  return (
    <div className="mx-auto max-w-6xl p-4 space-y-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Global Exchange</h1>
        <div className="flex gap-2">
          <Link href="/offers/new" className="hx-btn hx-btn--primary">New Offer</Link>
          <Link href="/browse" className="hx-btn hx-btn--outline-primary">Browse Offers</Link>
        </div>
      </header>

      {/* Global offers carousel */}
      {offers && offers.length > 0 ? (
        <div className="hx-card p-4">
          <CityOffersRail
            offers={offers}
            title="Latest offerings from the community"
            seeAllHref="/browse"
          />
        </div>
      ) : (
        <div className="hx-card p-6 text-sm text-gray-600">No offers yet.</div>
      )}

      {/* Global posts feed */}
      <section className="hx-card p-4 sm:p-6">
        <h2 className="mb-3 text-lg font-semibold">Latest posts</h2>
        {posts.length === 0 ? (
          <p className="text-sm text-gray-600">No posts yet.</p>
        ) : (
          <div className="space-y-3">
            {posts.map((p) => (
              <PostItem
                key={p.id}
                post={{ ...p, body: p.body ?? '', images: p.images ?? [] }}
                me={null}
                onDeleted={() => setPosts((prev) => prev.filter((x) => x.id !== p.id))}
              />
            ))}
          </div>
        )}
      </section>

      {msg && <p className="text-sm text-amber-700">{msg}</p>}
    </div>
  );
}
