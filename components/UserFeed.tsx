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

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr('');
      try {
        const { data: auth } = await supabase.auth.getUser();
        setMe(auth.user?.id ?? null);

        const { data, error } = await supabase
          .from('posts')
          .select('id,profile_id,body,created_at,images,profiles(display_name)')
          .eq('profile_id', profileId)
          .order('created_at', { ascending: false })
          .limit(200);
        if (error) throw error;
        setPosts((data || []) as PostRow[]);
      } catch (e: any) {
        setErr(e?.message ?? 'Failed to load posts.');
      } finally {
        setLoading(false);
      }
    })();
  }, [profileId]);

  return (
    <div className="space-y-3">
      {loading && <p className="text-sm text-gray-600">Loading…</p>}
      {err && <p className="text-sm text-amber-700">{err}</p>}

      {posts.map((p) => (
        <PostItem
          key={p.id}
          post={p}
          me={me}
          onDeleted={() => setPosts((prev) => prev.filter((x) => x.id !== p.id))}
        />
      ))}

      {!loading && posts.length === 0 && <p className="text-sm text-gray-600">No posts yet.</p>}
    </div>
  );
}
