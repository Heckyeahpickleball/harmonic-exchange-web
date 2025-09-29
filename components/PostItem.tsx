// /components/PostItem.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type PostRow = {
  id: string;
  profile_id: string;
  body: string;
  created_at: string;
  profiles?: { display_name?: string | null } | null;
};

type CommentRow = {
  id: string;
  post_id: string;
  profile_id: string;
  body: string;
  created_at: string;
  profiles?: { display_name?: string | null } | null;
};

type Props = {
  post: PostRow;
  me: string | null;
  onDeleted?: () => void;
};

export default function PostItem({ post, me, onDeleted }: Props) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [count, setCount] = useState<number>(0);
  const [loadingC, setLoadingC] = useState(false);
  const [err, setErr] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  // comment composer
  const [cText, setCText] = useState('');
  const [cBusy, setCBusy] = useState(false);
  const cRef = useRef<HTMLTextAreaElement | null>(null);

  // load count initially (cheap HEAD count)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { count: c, error } = await supabase
        .from('post_comments')
        .select('id', { count: 'exact', head: true })
        .eq('post_id', post.id);
      if (!cancelled) {
        if (!error && typeof c === 'number') setCount(c);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [post.id]);

  // open/close comments
  async function toggleComments() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (comments.length) return; // already loaded
    setLoadingC(true);
    setErr('');
    try {
      const { data, error } = await supabase
        .from('post_comments')
        .select('id, post_id, profile_id, body, created_at, profiles(display_name)')
        .eq('post_id', post.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setComments((data || []) as any);
      setCount(data?.length ?? 0); // sync to exact once loaded
    } catch (e: any) {
      setErr(e?.message ?? 'Could not load comments.');
    } finally {
      setLoadingC(false);
    }
  }

  // post a comment
  async function submitComment() {
    const body = cText.trim();
    if (!me || !body || cBusy) return;
    setCBusy(true);
    setErr('');
    try {
      const { data, error } = await supabase
        .from('post_comments')
        .insert({ post_id: post.id, profile_id: me, body })
        .select('id, post_id, profile_id, body, created_at, profiles(display_name)')
        .single();
      if (error) throw error;
      setCText('');
      setComments((prev) => [...prev, data as any]);
      setCount((n) => n + 1);
      // keep focus for fast threading
      cRef.current?.focus();
    } catch (e: any) {
      setErr(e?.message ?? 'Could not comment.');
    } finally {
      setCBusy(false);
    }
  }

  function onCommentKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const ctrlOrCmd = e.ctrlKey || e.metaKey;
    if (e.key === 'Enter' && (ctrlOrCmd || !e.shiftKey)) {
      e.preventDefault();
      submitComment();
    }
  }

  // delete a comment (via menu + confirm)
  async function deleteComment(id: string) {
    if (!confirm('Delete this comment?')) return;
    const { error } = await supabase.from('post_comments').delete().eq('id', id);
    if (!error) {
      setComments((prev) => prev.filter((c) => c.id !== id));
      setCount((n) => Math.max(0, n - 1));
    }
  }

  // delete post (menu)
  async function deletePost() {
    if (!confirm('Delete this post?')) return;
    const { error } = await supabase.from('posts').delete().eq('id', post.id);
    if (!error) onDeleted?.();
  }

  const myPost = me === post.profile_id;
  const author = post.profiles?.display_name || 'Someone';

  return (
    <article className="rounded border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm">
          <div className="font-medium">{author}</div>
          <div className="text-xs text-gray-600">
            {new Date(post.created_at).toLocaleString()}
          </div>
        </div>

        {/* post menu */}
        <div className="relative">
          <button
            className="rounded px-2 py-1 text-xl leading-none"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Post actions"
          >
            …
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-10 w-32 rounded border bg-white p-1 text-sm shadow">
              {myPost && (
                <button
                  className="w-full rounded px-2 py-1 text-left hover:bg-gray-50"
                  onClick={() => {
                    setMenuOpen(false);
                    deletePost();
                  }}
                >
                  Delete post
                </button>
              )}
              <button
                className="w-full rounded px-2 py-1 text-left hover:bg-gray-50"
                onClick={() => setMenuOpen(false)}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="mt-2 whitespace-pre-wrap text-sm">{post.body}</p>

      {/* comments toggle */}
      <div className="mt-2">
        <button
          className="text-xs underline"
          onClick={toggleComments}
        >
          {open ? 'Hide comments' : `Show comments (${count})`}
        </button>
      </div>

      {/* comments list */}
      {open && (
        <div className="mt-2 space-y-2 rounded border bg-gray-50 p-2">
          {loadingC && <p className="text-xs text-gray-600">Loading…</p>}
          {err && <p className="text-xs text-amber-700">{err}</p>}

          {comments.map((c) => {
            const mine = me === c.profile_id;
            return (
              <div
                key={c.id}
                className="relative rounded bg-white p-2 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-medium">
                      {c.profiles?.display_name || 'Someone'}
                    </div>
                    <div className="text-xs text-gray-600">
                      {new Date(c.created_at).toLocaleString()}
                    </div>
                  </div>

                  {/* comment menu */}
                  <div className="relative">
                    <CommentKebab
                      canDelete={mine}
                      onDelete={() => deleteComment(c.id)}
                    />
                  </div>
                </div>
                <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
              </div>
            );
          })}

          {/* comment composer */}
          <div className="mt-2 flex items-end gap-2">
            <textarea
              ref={cRef}
              value={cText}
              onChange={(e) => setCText(e.target.value)}
              onKeyDown={onCommentKeyDown}
              rows={2}
              className="w-full resize-none rounded border px-2 py-1 text-sm"
              placeholder="Write a comment…"
            />
            <button
              onClick={submitComment}
              disabled={!me || cBusy || !cText.trim()}
              className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              {cBusy ? 'Posting…' : 'Post'}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

function CommentKebab({ canDelete, onDelete }: { canDelete: boolean; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        className="rounded px-2 py-1 text-xl leading-none"
        onClick={() => setOpen((v) => !v)}
        aria-label="Comment actions"
      >
        …
      </button>
      {open && (
        <div className="absolute right-0 z-10 w-32 rounded border bg-white p-1 text-sm shadow">
          {canDelete && (
            <button
              className="w-full rounded px-2 py-1 text-left hover:bg-gray-50"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
            >
              Delete comment
            </button>
          )}
          <button
            className="w-full rounded px-2 py-1 text-left hover:bg-gray-50"
            onClick={() => setOpen(false)}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
