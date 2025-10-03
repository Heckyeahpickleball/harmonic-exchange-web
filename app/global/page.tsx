'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import CityOffersRail, { CityOffer } from '@/components/CityOffersRail';
import PostItem from '@/components/PostItem';
import PostComposer from '@/components/PostComposer';

type FeedPost = {
  id: string;
  profile_id: string;
  body: string | null;
  created_at: string;
  images?: string[] | null;
  profiles?: { display_name: string | null } | null;
  group_id?: string | null;
};

export default function GlobalExchangePage() {
  const [meId, setMeId] = useState<string | null>(null);

  const [offers, setOffers] = useState<CityOffer[] | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    function shuffle<T>(arr: T[]): T[] {
      // Fisher–Yates in-place shuffle
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }

    (async () => {
      try {
        setLoading(true);
        setMsg('');

        // who am I?
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id ?? null;
        if (!cancelled) setMeId(uid);

        // OFFERS: all active (local + online), random order each load
        const { data: oRows } = await supabase
          .from('offers')
          .select('id,title,images,owner_id,created_at,status')
          .eq('status', 'active')
          .limit(96); // grab a good chunk

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

        const randomized = shuffle(list.slice()); // new randomized order
        if (!cancelled) setOffers(randomized);

        // POSTS: **only global** (group_id IS NULL), newest first
        const { data: pRows } = await supabase
          .from('posts')
          .select('id,profile_id,body,created_at,images,group_id,profiles(display_name)')
          .is('group_id', null) // <- global only
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
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
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

      {/* Global offers carousel (randomized each load) */}
      {offers && offers.length > 0 ? (
        <div className="hx-card p-4">
          <CityOffersRail
            offers={offers}
            title="Offerings from across the community"
            seeAllHref="/browse"
          />
        </div>
      ) : (
        <div className="hx-card p-6 text-sm text-gray-600">
          {loading ? 'Loading offers…' : 'No offers yet.'}
        </div>
      )}

      {/* Composer (global scope) */}
      <section className="hx-card p-4 sm:p-6">
        <h2 className="mb-3 text-lg font-semibold">Share with the whole community</h2>
        {meId ? (
          <PostComposer
            profileId={meId}
            groupId={null} // <- GLOBAL
            onPost={(row) => setPosts((prev) => [row as FeedPost, ...prev])}
          />
        ) : (
          <div className="flex items-center justify-between rounded border p-3">
            <p className="text-sm text-gray-600">Sign in to post.</p>
            <Link href="/sign-in" className="hx-btn hx-btn--outline-primary">Sign in</Link>
          </div>
        )}
      </section>

      {/* Global posts feed (only group_id = NULL) */}
      <section className="hx-card p-4 sm:p-6">
        <h2 className="mb-3 text-lg font-semibold">Latest posts</h2>
        {posts.length === 0 ? (
          <p className="text-sm text-gray-600">{loading ? 'Loading posts…' : 'No posts yet.'}</p>
        ) : (
          <div className="space-y-3">
            {posts.map((p) => (
              <PostItem
                key={p.id}
                post={{ ...p, body: p.body ?? '', images: p.images ?? [] }}
                me={meId} // <- enable author delete + comment controls
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
