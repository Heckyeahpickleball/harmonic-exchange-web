// /components/UserFeed.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import PostItem from './PostItem';

type PostRow = {
  id: string;
  profile_id: string;
  body: string;
  created_at: string;
  profiles?: { display_name?: string | null } | null;
};

type Props = {
  profileId: string;
};

export default function UserFeed({ profileId }: Props) {
  const [me, setMe] = useState<string | null>(null);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function load() {
    setLoading(true);
    setErr('');
    try {
      const { data: auth } = await supabase.auth.getUser();
      setMe(auth?.user?.id ?? null);

      const { data, error } = await supabase
        .from('posts')
        .select('id, profile_id, body, created_at, profiles(display_name)')
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setPosts((data || []) as any);
    } catch (e: any) {
      setErr(e?.message ?? 'Could not load posts.');
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
      {/* NOTE: Composer intentionally NOT rendered here to avoid duplicates.
          The page decides if/where to show a composer. */}

      {loading && <p className="text-sm text-gray-600">Loading…</p>}
      {err && <p className="text-sm text-amber-700">{err}</p>}

      {posts.map((post) => (
        <PostItem
          key={post.id}
          post={post}
          me={me}
          onDeleted={() =>
            setPosts((prev) => prev.filter((p) => p.id !== post.id))
          }
        />
      ))}
    </div>
  );
}
