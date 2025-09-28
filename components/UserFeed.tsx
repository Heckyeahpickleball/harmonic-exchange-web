// /components/UserFeed.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import PostComposer from './PostComposer';
import PostItem from './PostItem';

type PostRow = {
  id: string;
  profile_id: string;
  body: string;
  created_at: string;
};

export default function UserFeed({
  profileId,
  me,
}: {
  profileId: string;
  me: string | null;
}) {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>('');
  const [unsupported, setUnsupported] = useState(false);

  const canCompose = useMemo(() => !!me && me === profileId, [me, profileId]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    setUnsupported(false);

    try {
      const { data, error } = await supabase
        .from('posts')
        .select('id, profile_id, body, created_at')
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setPosts((data || []) as PostRow[]);
    } catch (e: any) {
      if (
        typeof e?.message === 'string' &&
        e.message.toLowerCase().includes('does not exist')
      ) {
        setUnsupported(true);
        setPosts([]);
      } else {
        setErr(e?.message ?? 'Failed to load feed.');
        setPosts([]);
      }
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Posts</h2>

      {unsupported && (
        <div className="rounded border p-3 text-sm text-gray-600">
          Feed coming soon.
        </div>
      )}

      {!unsupported && canCompose && (
        <PostComposer
          onPost={async (text) => {
            const { data, error } = await supabase
              .from('posts')
              .insert({ profile_id: profileId, body: text.trim() })
              .select('id, profile_id, body, created_at')
              .single();
            if (error) throw error;
            setPosts((prev) => [data as PostRow, ...prev]);
          }}
        />
      )}

      {!unsupported && (
        <>
          {loading ? (
            <p className="text-sm text-gray-600">Loading…</p>
          ) : err ? (
            <p className="text-sm text-amber-700">{err}</p>
          ) : posts.length === 0 ? (
            <p className="text-sm text-gray-600">No posts yet.</p>
          ) : (
            <ul className="space-y-3">
              {posts.map((p) => (
                <li key={p.id}>
                  <PostItem
                    post={p}
                    me={me}
                    onDeleted={() =>
                      setPosts((prev) => prev.filter((x) => x.id !== p.id))
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
