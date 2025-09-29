'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type CommentRow = {
  id: string;
  post_id: string;
  profile_id: string;
  body: string | null;
  images: string[] | null;
  created_at: string;
  author_name: string | null;
};

export type PostItemProps = {
  post: {
    id: string;
    profile_id: string;
    body: string | null;
    images: string[] | null;
    created_at: string;
    author_name: string | null;
  };
  me: string | null;
  onDeleted?: () => void;
};

export default function PostItem({ post, me, onDeleted }: PostItemProps) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [cText, setCText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // count (fast head query)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { count } = await supabase
        .from('post_comments')
        .select('id', { count: 'exact', head: true })
        .eq('post_id', post.id);
      if (!cancelled) setCount(count ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [post.id]);

  async function loadComments() {
    setErr(null);
    const { data, error } = await supabase
      .from('post_comments')
      .select('id, post_id, profile_id, body, images, created_at')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true })
      .limit(200);
    if (error) {
      setErr(error.message);
      return;
    }

    // enrich author_name in one shot for all commenters
    const ids = Array.from(new Set((data || []).map((r: any) => r.profile_id)));
    let nameMap = new Map<string, string | null>();
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id, display_name').in('id', ids);
      (profs || []).forEach((p: any) => nameMap.set(p.id, p.display_name ?? null));
    }

    const rows: CommentRow[] = (data || []).map((r: any) => ({
      id: r.id,
      post_id: r.post_id,
      profile_id: r.profile_id,
      body: r.body,
      images: (r.images as string[] | null) ?? null,
      created_at: r.created_at,
      author_name: nameMap.get(r.profile_id) ?? null,
    }));

    setComments(rows);
  }

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && comments.length === 0) await loadComments();
  }

  async function addComment() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const body = cText.trim() || null;
      if (!body) {
        setErr('Write a comment.');
        setBusy(false);
        return;
      }
      const { data, error } = await supabase
        .from('post_comments')
        .insert([{ post_id: post.id, body }])
        .select('id, post_id, profile_id, body, created_at')
        .single();
      if (error) throw error;

      // fetch my name once
      const { data: meProf } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', data.profile_id)
        .single();

      const row: CommentRow = {
        id: data.id,
        post_id: data.post_id,
        profile_id: data.profile_id,
        body: data.body,
        images: null,
        created_at: data.created_at,
        author_name: meProf?.display_name ?? null,
      };
      setComments((prev) => [...prev, row]);
      setCount((n) => (n ?? 0) + 1);
      setCText('');
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to comment.');
    } finally {
      setBusy(false);
    }
  }

  async function deletePost() {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    const { error } = await supabase.from('posts').delete().eq('id', post.id);
    if (!error) onDeleted?.();
  }

  async function deleteComment(id: string) {
    if (!confirm('Delete this comment?')) return;
    const { error } = await supabase.from('post_comments').delete().eq('id', id);
    if (!error) {
      setComments((prev) => prev.filter((c) => c.id !== id));
      setCount((n) => Math.max(0, (n ?? 0) - 1));
    }
  }

  function onPostKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addComment();
    }
  }

  return (
    <article className="rounded-xl border">
      <div className="flex items-start justify-between p-3">
        <div>
          <div className="text-sm font-medium">{post.author_name ?? 'Someone'}</div>
          <div className="text-xs text-gray-500">
            {new Date(post.created_at).toLocaleString()}
          </div>
        </div>

        {/* 3-dot menu for post */}
        {me === post.profile_id && (
          <div className="relative" ref={menuRef}>
            <button
              className="rounded border px-2 py-1 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                const el = menuRef.current?.querySelector<HTMLDivElement>('[data-menu]');
                if (el) el.classList.toggle('hidden');
              }}
            >
              …
            </button>
            <div data-menu className="absolute right-0 z-10 hidden w-28 overflow-hidden rounded border bg-white shadow">
              <button className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50" onClick={deletePost}>
                Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {post.body && <p className="px-3 pb-2 text-sm">{post.body}</p>}

      {post.images && post.images.length > 0 && (
        <div className="grid grid-cols-1 gap-1 p-3">
          {post.images.map((u, i) => (
            <img key={i} src={u} className="max-h-[360px] w-full rounded object-cover" />
          ))}
        </div>
      )}

      <div className="border-t px-3 py-2 text-xs">
        <button className="underline" onClick={toggle}>
          {open ? 'Hide comments' : `Show comments (${count ?? 0})`}
        </button>
      </div>

      {open && (
        <div className="space-y-2 border-t p-3">
          {comments.map((c) => (
            <div key={c.id} className="rounded border bg-gray-50 p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="text-xs text-gray-600">
                  <span className="font-medium text-gray-800">{c.author_name ?? 'Someone'}</span>{' '}
                  • {new Date(c.created_at).toLocaleString()}
                </div>
                {me === c.profile_id && (
                  <div className="relative">
                    <button
                      className="rounded border px-2 py-0.5 text-xs"
                      onClick={(e) => {
                        const dd = (e.currentTarget.nextSibling as HTMLDivElement) || null;
                        dd?.classList.toggle('hidden');
                      }}
                    >
                      …
                    </button>
                    <div className="absolute right-0 z-10 hidden w-28 overflow-hidden rounded border bg-white shadow">
                      <button className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50" onClick={() => deleteComment(c.id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {c.body && <div className="mt-1 text-sm">{c.body}</div>}
              {c.images && c.images.length > 0 && (
                <div className="mt-2 grid grid-cols-1 gap-1">
                  {c.images.map((u, i) => (
                    <img key={i} src={u} className="max-h-64 w-full rounded object-cover" />
                  ))}
                </div>
              )}
            </div>
          ))}

          <div className="mt-2 flex items-start gap-2">
            <textarea
              value={cText}
              onChange={(e) => setCText(e.target.value)}
              onKeyDown={onPostKey}
              rows={2}
              placeholder="Write a comment…"
              className="w-full resize-none rounded border px-3 py-2 text-sm"
            />
            <button className="rounded bg-black px-3 py-2 text-xs text-white disabled:opacity-50" disabled={busy} onClick={addComment}>
              Post
            </button>
          </div>
          {err && <p className="text-xs text-amber-700">{err}</p>}
        </div>
      )}
    </article>
  );
}
