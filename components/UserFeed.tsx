// /components/UserFeed.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import PostItem from '@/components/PostItem';

type PostRow = {
  id: string;
  profile_id: string;
  body: string;
  created_at: string;
  profiles?: { display_name: string | null } | null;
};

type Props = {
  /** Whose feed to show */
  profileId: string;
};

export default function UserFeed({ profileId }: Props) {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>('');

  async function load() {
    setLoading(true);
    setErr('');
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(
          `
          id,
          profile_id,
          body,
          created_at,
          profiles:profiles!inner ( display_name )
        `
        )
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts((data as unknown as PostRow[]) ?? []);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to load posts.');
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  return (
    <div className="space-y-3">
      {loading && <p className="text-sm text-gray-600">Loading…</p>}
      {err && <p className="text-sm text-amber-700">{err}</p>}
      {!loading && posts.length === 0 && <p className="text-sm text-gray-600">No posts yet.</p>}

      {posts.map((p) => (
        <PostItem
          key={p.id}
          post={p}
          onDeleted={() => setPosts((prev) => prev.filter((x) => x.id !== p.id))}
        />
      ))}
    </div>
  );
}
