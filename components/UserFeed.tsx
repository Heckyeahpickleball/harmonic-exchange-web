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
  profiles?: { display_name: string | null } | null;
  // If your schema later adds like_count/comments_count, we will use them automatically
  like_count?: number | null;
  comments_count?: number | null;
};

type SortMode = 'recent' | 'popular';

export default function UserFeed({ profileId }: { profileId: string }) {
  const [basePosts, setBasePosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [me, setMe] = useState<string | null>(null);

  // Filter/Sort UI
  const [menuOpen, setMenuOpen] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [search, setSearch] = useState('');

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
          // Removed like_count, comments_count from the select
          .select('id,profile_id,body,created_at,images,profiles(display_name)')
          .eq('profile_id', profileId)
          .order('created_at', { ascending: false })
          .limit(200);

        if (error) throw error;
        if (!cancelled) {
          const rows =
            (data || []).map((row: any) => ({
              ...row,
              profiles: Array.isArray(row.profiles) ? row.profiles[0] || null : row.profiles ?? null,
            })) as PostRow[];

          setBasePosts(rows);
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
        // Removed like_count, comments_count from the select
        .select('id,profile_id,body,created_at,images,profiles(display_name)')
        .eq('id', id)
        .maybeSingle();
      if (error) return null;
      if (!data) return null;
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
          setBasePosts((prev) => (prev.some((p) => p.id === row.id) ? prev : [row, ...prev]));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'posts', filter: `profile_id=eq.${profileId}` },
        (payload) => {
          const id = (payload.old as any)?.id as string | undefined;
          if (!id) return;
          setBasePosts((prev) => prev.filter((p) => p.id !== id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId]);

  // --- Popularity heuristic ---
  // Uses like_count/comments_count if present; otherwise falls back to a simple heuristic
  function popularityScore(p: PostRow): number {
    const likes = p.like_count ?? 0;
    const comments = p.comments_count ?? 0;
    const imgs = p.images?.length ?? 0;
    const words = (p.body || '').trim().split(/\s+/).filter(Boolean).length;
    return likes * 5 + comments * 3 + imgs * 2 + words / 40;
  }

  // --- Search ranking ---
  function searchScore(p: PostRow, query: string): number {
    if (!query.trim()) return 0;
    const q = query.toLowerCase();
    const hay = (p.body || '').toLowerCase();
    if (!hay) return 0;

    const occurrences = hay.split(q).length - 1;
    let wordStart = 0;
    const words = hay.split(/\b/);
    for (const w of words) {
      if (w.startsWith(q)) wordStart++;
    }
    return occurrences * 2 + wordStart;
  }

  // Derive final list: sort then apply search boosting
  const posts = useMemo(() => {
    const bySort =
      sortMode === 'recent'
        ? [...basePosts].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
        : [...basePosts].sort((a, b) => popularityScore(b) - popularityScore(a));

    if (!search.trim()) return bySort;

    const scored = bySort.map((p) => ({ p, s: searchScore(p, search) }));
    const hits = scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s).map((x) => x.p);
    const rest = scored.filter((x) => x.s === 0).map((x) => x.p);
    return [...hits, ...rest];
  }, [basePosts, sortMode, search]);

  return (
    <div className="space-y-3">
      {/* Thin line button (under composer on pages that place this component there) */}
      <div className="relative">
        <button
          type="button"
          className="w-full text-left text-xs text-gray-600 hover:text-gray-800 border-b pb-1"
          onClick={() => setMenuOpen((s) => !s)}
          aria-expanded={menuOpen}
        >
          Filter & Sort
        </button>

        {menuOpen && (
          <div className="absolute z-10 mt-1 w-full rounded border bg-white p-2 shadow">
            <div className="flex flex-wrap items-center gap-2">
              {/* Sort toggle */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-xs text-gray-600">Sort:</span>
                <button
                  type="button"
                  className={`rounded border px-2 py-1 text-xs ${
                    sortMode === 'recent' ? 'bg-gray-800 text-white' : 'bg-white'
                  }`}
                  onClick={() => setSortMode('recent')}
                >
                  Most Recent
                </button>
                <button
                  type="button"
                  className={`rounded border px-2 py-1 text-xs ${
                    sortMode === 'popular' ? 'bg-gray-800 text-white' : 'bg-white'
                  }`}
                  onClick={() => setSortMode('popular')}
                >
                  Most Popular
                </button>
              </div>

              {/* Search input */}
              <div className="flex-1 min-w-[160px]">
                <input
                  className="w-full rounded border px-2 py-1 text-sm"
                  placeholder="Search posts…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <button
                type="button"
                className="ml-auto rounded border px-2 py-1 text-xs"
                onClick={() => {
                  setSearch('');
                  setSortMode('recent');
                }}
              >
                Reset
              </button>
            </div>
          </div>
        )}
      </div>

      {loading && <p className="text-sm text-gray-600">Loading…</p>}
      {err && <p className="text-sm text-amber-700">{err}</p>}

      {posts.map((p) => (
        <PostItem
          key={p.id}
          post={{ ...p, body: p.body ?? '', images: p.images ?? [] }}
          me={me}
          onDeleted={() => setBasePosts((prev) => prev.filter((x) => x.id !== p.id))}
        />
      ))}

      {!loading && posts.length === 0 && <p className="text-sm text-gray-600">No posts yet.</p>}
    </div>
  );
}
