// /components/PostItem.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type PostRow = {
  id: string;
  profile_id: string;
  body: string;
  created_at: string;
};

type CommentRow = {
  id: string;
  post_id: string;
  profile_id: string;
  body: string;
  created_at: string;
  // When selecting `profiles ( display_name )`, Supabase returns a single object (not an array)
  profiles?: { display_name: string | null } | null;
};

export default function PostItem({
  post,
  me,
  onDeleted,
}: {
  post: PostRow;
  me: string | null;
  onDeleted?: () => void;
}) {
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>('');
  const [cText, setCText] = useState('');
  const canComment = !!me && cText.trim().length > 0;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setErr('');
      try {
        const { data, error } = await supabase
          .from('post_comments')
          .select(
            'id, post_id, profile_id, body, created_at, profiles ( display_name )'
          )
          .eq('post_id', post.id)
          .order('created_at', { ascending: true });

        if (error) throw error;
        if (!cancelled) setComments((data || []) as CommentRow[]);
      } catch (e: any) {
        // If the table doesn’t exist in prod yet, don’t break the page.
        if (
          typeof e?.message === 'string' &&
          e.message.toLowerCase().includes('does not exist')
        ) {
          setComments([]);
        } else {
          setErr(e?.message ?? 'Failed to load comments.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [post.id]);

  async function addComment() {
    const text = cText.trim();
    if (!me || !text) return;

    const optimistic: CommentRow = {
      id: `tmp-${Math.random().toString(36).slice(2)}`,
      post_id: post.id,
      profile_id: me,
      body: text,
      created_at: new Date().toISOString(),
      profiles: { display_name: 'You' },
    };
    setComments((prev) => [...prev, optimistic]);
    setCText('');

    try {
      const { data, error } = await supabase
        .from('post_comments')
        .insert({ post_id: post.id, profile_id: me, body: text })
        .select(
          'id, post_id, profile_id, body, created_at, profiles ( display_name )'
        )
        .single();
      if (error) throw error;
      setComments((prev) =>
        prev.map((c) => (c.id === optimistic.id ? (data as any) : c))
      );
    } catch {
      // revert insert
      setComments((prev) => prev.filter((c) => c.id !== optimistic.id));
      setCText(text);
      alert('Failed to comment.');
    }
  }

  return (
    <article className="rounded border p-3">
      <div className="text-sm text-gray-600">
        {new Date(post.created_at).toLocaleString()}
      </div>
      <p className="mt-1 whitespace-pre-wrap">{post.body}</p>

      {err && <p className="mt-2 text-sm text-amber-700">{err}</p>}

      {!loading && comments.length > 0 && (
        <ul className="mt-3 space-y-2">
          {comments.map((c) => (
            <li key={c.id} className="rounded bg-gray-50 p-2 text-sm">
              <div className="text-[11px] text-gray-500">
                {c.profiles?.display_name || 'Someone'} •{' '}
                {new Date(c.created_at).toLocaleString()}
              </div>
              <div className="whitespace-pre-wrap">{c.body}</div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex items-end gap-2">
        <textarea
          value={cText}
          onChange={(e) => setCText(e.target.value)}
          rows={2}
          className="flex-1 resize-none rounded border px-3 py-2 text-sm"
          placeholder={me ? 'Write a comment…' : 'Sign in to comment'}
          disabled={!me}
        />
        <button
          onClick={addComment}
          disabled={!canComment}
          className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          Comment
        </button>
      </div>

      {me === post.profile_id && (
        <div className="mt-2 text-right">
          <button
            className="text-xs underline"
            onClick={async () => {
              if (!confirm('Delete this post?')) return;
              const { error } = await supabase
                .from('posts')
                .delete()
                .eq('id', post.id);
              if (!error) onDeleted?.();
            }}
          >
            Delete post
          </button>
        </div>
      )}
    </article>
  );
}
