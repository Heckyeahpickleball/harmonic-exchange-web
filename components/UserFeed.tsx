// components/UserFeed.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import PostItem from './PostItem';

type PostRow = {
  id: string;
  profile_id: string;
  body: string | null;
  created_at: string;
  images?: string[] | null;
  profiles?: { display_name: string | null; avatar_url?: string | null } | null;
};

type SortKey = 'newest' | 'popular' | 'comments';

export default function UserFeed({ profileId }: { profileId: string }) {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [me, setMe] = useState<string | null>(null);

  // --- NEW: filter/search UI state ---
  const [uiOpen, setUiOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('newest');
  const [query, setQuery] = useState('');

  // --- NEW: counts for sorting ---
  const [heartCount, setHeartCount] = useState<Record<string, number>>({});
  const [commentCount, setCommentCount] = useState<Record<string, number>>({});

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr('');
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!cancelled) setMe(auth.user?.id ?? null);

        const { data, error } = await supabase
          .from('posts')
          .select('id,profile_id,body,created_at,images,profiles(display_name,avatar_url)')
          .eq('profile_id', profileId)
          .order('created_at', { ascending: false })
          .limit(200);

        if (error) throw error;
        if (!cancelled) {
          const shaped: PostRow[] = (data || []).map((row: any) => ({
            ...row,
            profiles: Array.isArray(row.profiles) ? row.profiles[0] || null : row.profiles ?? null,
          }));
          setPosts(shaped);
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? 'Failed to load posts.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  // Realtime: prepend INSERTs and remove on DELETE
  useEffect(() => {
    if (!profileId) return;

    async function fetchOne(id: string): Promise<PostRow | null> {
      const { data, error } = await supabase
        .from('posts')
        .select('id,profile_id,body,created_at,images,profiles(display_name,avatar_url)')
        .eq('id', id)
        .maybeSingle();
      if (error || !data) return null;
      return {
        ...data,
        profiles: Array.isArray(data.profiles) ? data.profiles[0] || null : data.profiles ?? null,
      } as PostRow;
    }

    const channel = supabase
      .channel(`posts:profile:${profileId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts', filter: `profile_id=eq.${profileId}` },
        async (payload) => {
          const id = (payload.new as any)?.id as string | undefined;
          if (!id) return;
          const row = await fetchOne(id);
          if (!row) return;
          setPosts((prev) => (prev.some((p) => p.id === row.id) ? prev : [row, ...prev]));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'posts', filter: `profile_id=eq.${profileId}` },
        (payload) => {
          const id = (payload.old as any)?.id as string | undefined;
          if (!id) return;
          setPosts((prev) => prev.filter((p) => p.id !== id));
          setHeartCount((m) => {
            const n = { ...m };
            delete n[id];
            return n;
          });
          setCommentCount((m) => {
            const n = { ...m };
            delete n[id];
            return n;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId]);

  // --- NEW: batch-fetch hearts + comments for visible posts ---
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
        // Hearts (target_type='post')
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

        // Comments
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
      } catch (e) {
        // Non-fatal: leave maps as-is
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [posts]);

  // --- NEW: computed filtered/sorted list ---
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

    const byNewest = (a: PostRow, b: PostRow) =>
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
  }, [posts, sortBy, query, heartCount, commentCount]);

  return (
    <div className="space-y-3">
      {/* --- NEW: compact filter toggle --- */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="text-xs rounded-full border px-3 py-1 hover:bg-gray-50"
          onClick={() => setUiOpen((v) => !v)}
          aria-expanded={uiOpen}
          aria-controls="post-filter-panel"
          title="Open post filters"
        >
          Post filter
        </button>

        {/* quick sort indicator on the right (collapsed) */}
        {!uiOpen && (
          <div className="text-xs text-gray-600">
            {sortBy === 'newest' ? 'Newest' : sortBy === 'popular' ? 'Popular' : 'Most comments'}
            {query ? ' • search active' : ''}
          </div>
        )}
      </div>

      {uiOpen && (
        <div
          id="post-filter-panel"
          className="rounded-lg border p-3 bg-white shadow-sm"
        >
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

      {loading && <p className="text-sm text-gray-600">Loading…</p>}
      {err && <p className="text-sm text-amber-700">{err}</p>}

      {visible.map((p) => (
        <PostItem
          key={p.id}
          post={{ ...p, body: p.body ?? '', images: p.images ?? [] }}
          me={me}
          onDeleted={() => setPosts((prev) => prev.filter((x) => x.id !== p.id))}
        />
      ))}

      {!loading && visible.length === 0 && (
        <p className="text-sm text-gray-600">
          {query ? 'No matches found.' : 'No posts yet.'}
        </p>
      )}
    </div>
  );
}
