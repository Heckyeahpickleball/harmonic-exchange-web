// /components/PostItem.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type Post = {
  id: string;
  profile_id: string;
  body: string;
  created_at: string;
  // When the parent selects a join, it may provide the author object here.
  // We won't rely on its exact type; we only read display_name defensively.
  profiles?: any;
};

type Props = {
  post: Post;
  me: string | null;
  onDeleted?: () => void;
};

type CommentItem = {
  id: string;
  post_id: string;
  profile_id: string;
  body: string;
  created_at: string;
  author_name: string;
};

export default function PostItem({ post, me, onDeleted }: Props) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const authorName = useMemo(() => {
    if (!post?.profiles) return 'Someone';
    // profiles can arrive as an object or array depending on how the relation
    // is inferred on the server. Handle both shapes.
    const maybe = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;
    return maybe?.display_name || 'Someone';
  }, [post]);

  async function loadComments() {
    try {
      setErr(null);
      // Note: We intentionally keep the type as `any` and normalize below,
      // because Supabase can surface `profiles(...)` as an array depending on FK naming.
      const { data, error } = await supabase
        .from('post_comments')
        .select('id, post_id, profile_id, body, created_at, profiles(display_name)')
        .eq('post_id', post.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const mapped: CommentItem[] = (data as any[] | null | undefined)?.map((row: any) => {
        const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        const name = p?.display_name || 'Someone';
        return {
          id: String(row.id),
          post_id: String(row.post_id),
          profile_id: String(row.profile_id),
          body: String(row.body ?? ''),
          created_at: String(row.created_at),
          author_name: name,
        };
      }) ?? [];

      setComments(mapped);
    } catch (e: any) {
      // If the table doesn't exist in prod yet, don't break the page.
      const msg = String(e?.message ?? '');
      if (!msg.toLowerCase().includes('does not exist')) {
        setErr(msg || 'Failed to load comments.');
      }
      setComments([]);
    }
  }

  useEffect(() => {
    if (open) void loadComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, post.id]);

  async function addComment() {
    const text = draft.trim();
    if (!text || !me) return;
    setBusy(true);
    setErr(null);

    try {
      const { error } = await supabase
        .from('post_comments')
        .insert({
          post_id: post.id,
          profile_id: me,
          body: text,
        });
      if (error) throw error;

      setDraft('');
      await loadComments();
    } catch (e: any) {
      setErr(e?.message ?? 'Could not add comment.');
    } finally {
      setBusy(false);
    }
  }

  async function deletePost() {
    if (!me || me !== post.profile_id) return;
    if (!confirm('Delete this post?')) return;
    try {
      const { error } = await supabase.from('posts').delete().eq('id', post.id);
      if (error) throw error;
      onDeleted?.();
    } catch (e: any) {
      alert(e?.message ?? 'Failed to delete post.');
    }
  }

  async function deleteComment(id: string) {
    if (!me) return;
    try {
      const { error } = await supabase.from('post_comments').delete().eq('id', id).eq('profile_id', me);
      if (error) throw error;
      setComments(prev => prev.filter(c => c.id !== id));
    } catch (e: any) {
      alert(e?.message ?? 'Failed to delete comment.');
    }
  }

  const authorHref = me && me === post.profile_id ? '/profile' : `/u/${post.profile_id}`;

  return (
    <article className="rounded border p-3">
      <div className="mb-1 flex items-center justify-between">
        <div className="text-sm text-gray-700">
          <Link href={authorHref} className="underline">{authorName}</Link>{' '}
          <span className="text-gray-500">• {new Date(post.created_at).toLocaleString()}</span>
        </div>

        {me === post.profile_id && (
          <button onClick={deletePost} className="text-xs underline">
            Delete post
          </button>
        )}
      </div>

      <div className="whitespace-pre-wrap">{post.body}</div>

      <div className="mt-3">
        <button
          className="text-xs underline"
          onClick={() => setOpen(v => !v)}
        >
          {open ? 'Hide comments' : `Show comments (${comments.length})`}
        </button>
      </div>

      {open && (
        <div className="mt-2 space-y-2">
          {err && <div className="text-xs text-red-600">{err}</div>}

          {comments.length === 0 ? (
            <div className="text-sm text-gray-600">No comments yet.</div>
          ) : (
            <ul className="space-y-2">
              {comments.map(c => {
                const canDel = me === c.profile_id;
                const whoHref = me && me === c.profile_id ? '/profile' : `/u/${c.profile_id}`;
                return (
                  <li key={c.id} className="rounded bg-gray-50 p-2">
                    <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
                      <div>
                        <Link href={whoHref} className="underline">{c.author_name}</Link>{' '}
                        • {new Date(c.created_at).toLocaleString()}
                      </div>
                      {canDel && (
                        <button className="underline" onClick={() => deleteComment(c.id)}>
                          Delete
                        </button>
                      )}
                    </div>
                    <div className="whitespace-pre-wrap text-sm text-gray-800">{c.body}</div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Composer */}
          <div className="mt-2 flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={me ? 'Write a comment…' : 'Sign in to comment'}
              disabled={!me || busy}
              className="flex-1 rounded border px-3 py-2 text-sm disabled:opacity-60"
            />
            <button
              onClick={addComment}
              disabled={!me || busy || !draft.trim()}
              className="rounded border px-3 py-2 text-sm disabled:opacity-60"
            >
              {busy ? 'Posting…' : 'Post'}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
