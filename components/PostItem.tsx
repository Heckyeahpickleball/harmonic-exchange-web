// /components/PostItem.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type Post = {
  id: string;
  profile_id: string;
  body: string;
  created_at: string;
  profiles?: any; // parent may join; read defensively
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
  const [count, setCount] = useState<number>(0);          // true count (even before opening)
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const authorName = useMemo(() => {
    const p = Array.isArray(post.profiles) ? post.profiles?.[0] : post.profiles;
    return p?.display_name || 'Someone';
  }, [post]);

  const authorHref = me && me === post.profile_id ? '/profile' : `/u/${post.profile_id}`;

  // Click-away for ⋯ menu
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  // Fetch comment COUNT up-front so the link isn’t “(0)”
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { count: c, error } = await supabase
        .from('post_comments')
        .select('id', { count: 'exact', head: true })
        .eq('post_id', post.id);
      if (!cancelled && !error && typeof c === 'number') setCount(c);
    })();
    return () => { cancelled = true; };
  }, [post.id]);

  async function loadComments() {
    try {
      setErr(null);
      const { data, error } = await supabase
        .from('post_comments')
        .select('id, post_id, profile_id, body, created_at, profiles(display_name)')
        .eq('post_id', post.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const mapped: CommentItem[] = (data ?? []).map((row: any) => {
        const p = Array.isArray(row.profiles) ? row.profiles?.[0] : row.profiles;
        return {
          id: String(row.id),
          post_id: String(row.post_id),
          profile_id: String(row.profile_id),
          body: String(row.body ?? ''),
          created_at: String(row.created_at),
          author_name: p?.display_name || 'Someone',
        };
      });

      setComments(mapped);
      setCount(mapped.length); // keep count in sync once loaded
    } catch (e: any) {
      const msg = String(e?.message ?? '');
      if (!msg.toLowerCase().includes('does not exist')) setErr(msg || 'Failed to load comments.');
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
      const { error } = await supabase.from('post_comments').insert({
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
    if (!confirm('Delete this post? This cannot be undone.')) return;
    const { error } = await supabase.from('posts').delete().eq('id', post.id);
    if (error) {
      alert(error.message);
      return;
    }
    onDeleted?.();
  }

  async function deleteComment(id: string) {
    if (!me) return;
    if (!confirm('Delete this comment?')) return;
    const { error } = await supabase
      .from('post_comments')
      .delete()
      .eq('id', id)
      .eq('profile_id', me);
    if (error) {
      alert(error.message);
      return;
    }
    setComments(prev => prev.filter(c => c.id !== id));
    setCount(prev => Math.max(0, prev - 1));
  }

  return (
    <article className="rounded border p-3">
      <div className="mb-1 flex items-center justify-between">
        <div className="text-sm text-gray-700">
          <Link href={authorHref} className="underline">{authorName}</Link>{' '}
          <span className="text-gray-500">• {new Date(post.created_at).toLocaleString()}</span>
        </div>

        {me === post.profile_id && (
          <div className="relative" ref={menuRef}>
            <button
              aria-label="Post actions"
              className="rounded px-2 text-lg leading-none hover:bg-gray-100"
              onClick={() => setMenuOpen(v => !v)}
            >
              ⋯
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-10 w-28 overflow-hidden rounded border bg-white shadow-md">
                <button
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                  onClick={() => { setMenuOpen(false); void deletePost(); }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="whitespace-pre-wrap">{post.body}</div>

      <div className="mt-3">
        <button
          className="text-xs underline"
          onClick={() => setOpen(v => !v)}
        >
          {open ? 'Hide comments' : `Show comments (${count})`}
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

          {/* Comment composer */}
          <div className="mt-2 flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void addComment();
                }
              }}
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
