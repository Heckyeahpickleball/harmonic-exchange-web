// components/UserFeed.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import PostItem from './PostItem';

type PostRow = {
  id: string;
  profile_id: string;
  body: string | null;
  created_at: string;
  images?: string[] | null;
  profiles?: { display_name: string | null } | null;
};

export default function UserFeed({ profileId }: { profileId: string }) {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [me, setMe] = useState<string | null>(null);

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
          .select('id,profile_id,body,created_at,images,profiles(display_name)')
          .eq('profile_id', profileId)
          .order('created_at', { ascending: false })
          .limit(200);

        if (error) throw error;
        if (!cancelled) {
          setPosts(
            (data || []).map((row: any) => ({
              ...row,
              profiles: Array.isArray(row.profiles)
                ? row.profiles[0] || null
                : row.profiles ?? null,
            })) as PostRow[]
          );
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
        .select('id,profile_id,body,created_at,images,profiles(display_name)')
        .eq('id', id)
        .maybeSingle();
      if (error) return null;
      if (!data) return null;
      return {
        ...data,
        profiles: Array.isArray(data.profiles)
          ? data.profiles[0] || null
          : data.profiles ?? null,
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
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId]);

  return (
    <div className="space-y-3">
      {loading && <p className="text-sm text-gray-600">Loading…</p>}
      {err && <p className="text-sm text-amber-700">{err}</p>}

      {posts.map((p) => (
        <PostItem
          key={p.id}
          post={{
            ...p,
            images: p.images ?? null,
            author_name: p.profiles?.display_name ?? null,
          }}
          me={me}
          onDeleted={() => setPosts((prev) => prev.filter((x) => x.id !== p.id))}
        />
      ))}

      {!loading && posts.length === 0 && (
        <p className="text-sm text-gray-600">No posts yet.</p>
      )}
    </div>
  );
}
