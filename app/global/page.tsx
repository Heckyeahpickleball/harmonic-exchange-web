// /app/global/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
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
  profiles?: { display_name: string | null; avatar_url?: string | null } | null;
  group_id?: string | null;
};

type SortKey = 'newest' | 'popular' | 'comments';

export default function GlobalExchangePage() {
  const [meId, setMeId] = useState<string | null>(null);

  const [offers, setOffers] = useState<CityOffer[] | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  // --- NEW: filter/search UI state ---
  const [uiOpen, setUiOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('newest');
  const [query, setQuery] = useState('');

  // --- NEW: counts used for sorting ---
  const [heartCount, setHeartCount] = useState<Record<string, number>>({});
  const [commentCount, setCommentCount] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;

    function shuffle<T>(arr: T[]): T[] {
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

        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id ?? null;
        if (!cancelled) setMeId(uid);

        // ---- OFFERS (unchanged) ----
        const { data: oRows } = await supabase
          .from('offers')
          .select('id,title,images,owner_id,created_at,status')
          .eq('status', 'active')
          .limit(96);

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

        const randomized = shuffle(list.slice());
        if (!cancelled) setOffers(randomized);

        // ---- POSTS (global only) ----
        const { data: pRows } = await supabase
          .from('posts')
          .select('id,profile_id,body,created_at,images,group_id,profiles(display_name,avatar_url)')
          .is('group_id', null)
          .order('created_at', { ascending: false })
          .limit(200);

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

  // --- NEW: batch fetch hearts + comments for current posts ---
  useEffect(() => {
    let cancelled = false;
    const ids = posts.map((p) => p.id);
    if (ids.length === 0) {
      setHeartCount({});
      setCommentCount({});
      return;
    }

    (async () => {
      try {
        // hearts for posts
        const { data: hearts, error: hErr } = await supabase
          .from('hearts')
          .select('target_id')
          .eq('target_type', 'post')
          .in('target_id', ids);
        if (hErr) throw hErr;

        const heartMap: Record<string, number> = {};
        (hearts || []).forEach((row: any) => {
          const id = String(row.target_id);
          heartMap[id] = (heartMap[id] || 0) + 1;
        });

        // comment counts
        const { data: comments, error: cErr } = await supabase
          .from('post_comments')
          .select('post_id')
          .in('post_id', ids);
        if (cErr) throw cErr;

        const commentMap: Record<string, number> = {};
        (comments || []).forEach((row: any) => {
          const id = String(row.post_id);
          commentMap[id] = (commentMap[id] || 0) + 1;
        });

        if (!cancelled) {
          setHeartCount(heartMap);
          setCommentCount(commentMap);
        }
      } catch {
        // non-fatal
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [posts]);

  // --- NEW: filter + sort ---
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = posts;

    if (q) {
      list = list.filter((p) => {
        const t = (p.body || '').toLowerCase();
        const name = (p.profiles?.display_name || '').toLowerCase();
        return t.includes(q) || name.includes(q);
      });
    }

    const byNewest = (a: FeedPost, b: FeedPost) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    const getHearts = (id: string) => heartCount[id] || 0;
    const getComments = (id: string) => commentCount[id] || 0;

    if (sortBy === 'popular') {
      return [...list].sort((a, b) => getHearts(b.id) - getHearts(a.id) || byNewest(a, b));
    }
    if (sortBy === 'comments') {
      return [...list].sort((a, b) => getComments(b.id) - getComments(a.id) || byNewest(a, b));
    }
    return [...list].sort(byNewest);
  }, [posts, query, sortBy, heartCount, commentCount]);

  return (
    <div className="mx-auto max-w-6xl px-0 sm:px-3 md:px-4 py-2 space-y-7">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Global Exchange</h1>
        <div className="flex gap-2">
          <Link href="/offers/new" className="hx-btn hx-btn--primary">New Offer</Link>
          <Link href="/browse" className="hx-btn hx-btn--outline-primary">Browse Offers</Link>
        </div>
      </header>

      {/* Global offers carousel (randomized each load) */}
      {offers && offers.length > 0 ? (
        <div className="hx-card p-3 pt-1 sm:p-4 sm:pt-2">
          <CityOffersRail
            offers={offers}
            title="Offerings across the community"
            seeAllHref="/browse"
          />
        </div>
      ) : (
        <div className="hx-card p-6 text-sm text-gray-600">
          {loading ? 'Loading offers…' : 'No offers yet.'}
        </div>
      )}

      {/* Composer (global scope) — no wrapper box */}
      <section>
        {meId ? (
          <PostComposer
            profileId={meId}
            groupId={null}
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
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Latest posts</h2>

          {/* --- NEW: compact post filter toggle + hint --- */}
          <div className="flex items-center gap-3">
            {!uiOpen && (
              <div className="text-xs text-gray-600">
                {sortBy === 'newest' ? 'Newest' : sortBy === 'popular' ? 'Popular' : 'Most comments'}
                {query ? ' • search active' : ''}
              </div>
            )}
            <button
              type="button"
              className="text-xs rounded-full border px-3 py-1 hover:bg-gray-50"
              onClick={() => setUiOpen((v) => !v)}
              aria-expanded={uiOpen}
              aria-controls="global-post-filter-panel"
              title="Open post filters"
            >
              Post filter
            </button>
          </div>
        </div>

        {uiOpen && (
          <div id="global-post-filter-panel" className="mb-4 rounded-lg border p-3 bg-white shadow-sm">
            <div className="grid gap-3 sm:grid-cols-3">
              {/* Sort */}
              <div className="sm:col-span-1">
                <div className="text-xs font-semibold mb-1">Sort by</div>
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex items-center gap-1 text-xs">
                    <input
                      type="radio"
                      name="sort"
                      value="newest"
                      checked={sortBy === 'newest'}
                      onChange={() => setSortBy('newest')}
                    />
                    Newest
                  </label>
                  <label className="inline-flex items-center gap-1 text-xs">
                    <input
                      type="radio"
                      name="sort"
                      value="popular"
                      checked={sortBy === 'popular'}
                      onChange={() => setSortBy('popular')}
                    />
                    Popular (❤️)
                  </label>
                  <label className="inline-flex items-center gap-1 text-xs">
                    <input
                      type="radio"
                      name="sort"
                      value="comments"
                      checked={sortBy === 'comments'}
                      onChange={() => setSortBy('comments')}
                    />
                    Most comments
                  </label>
                </div>
              </div>

              {/* Search */}
              <div className="sm:col-span-2">
                <div className="text-xs font-semibold mb-1">Search posts or authors</div>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Type keywords or a name…"
                  className="w-full rounded border px-3 py-2 text-sm"
                />
                <div className="mt-1 text-[11px] text-gray-500">
                  Searches post text and the author’s display name.
                </div>
              </div>
            </div>
          </div>
        )}

        {visible.length === 0 ? (
          <p className="text-sm text-gray-600">{loading ? 'Loading posts…' : 'No posts yet.'}</p>
        ) : (
          <div className="space-y-3">
            {visible.map((p) => (
              <PostItem
                key={p.id}
                post={{ ...p, body: p.body ?? '', images: p.images ?? [] }}
                me={meId}
                onDeleted={() => {
                  setPosts((prev) => prev.filter((x) => x.id !== p.id));
                  setHeartCount((m) => {
                    const n = { ...m };
                    delete n[p.id];
                    return n;
                  });
                  setCommentCount((m) => {
                    const n = { ...m };
                    delete n[p.id];
                    return n;
                  });
                }}
              />
            ))}
          </div>
        )}
      </section>

      {msg && <p className="text-sm text-amber-700">{msg}</p>}
    </div>
  );
}
