// components/PostItem.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

/* ---------- Types ---------- */
type PostRow = {
  id: string;
  profile_id: string;
  body: string;
  images: string[]; // text[]
  created_at: string;
  profiles?: { display_name: string | null } | null;
};

type CommentRow = {
  id: string;
  post_id: string;
  profile_id: string;
  body: string;
  images: string[];
  created_at: string;
  profiles?: { display_name: string | null } | null;
};

/* ---------- Utils ---------- */
function dedupeById<T extends { id: string }>(arr: T[]): T[] {
  const map = new Map<string, T>();
  for (const x of arr) map.set(x.id, x);
  return Array.from(map.values());
}

/* ---------- Simple Kebab Menu + Confirm ---------- */
function Kebab({
  items,
  onClose,
}: {
  items: Array<{ label: string; action: () => void }>;
  onClose: () => void;
}) {
  return (
    <div className="absolute right-0 mt-1 w-36 rounded border bg-white shadow z-10">
      {items.map((it, i) => (
        <button
          key={i}
          className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
          onClick={() => {
            it.action();
            onClose();
          }}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

function ConfirmInline({
  text,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  busy,
}: {
  text: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  return (
    <div className="mt-2 flex items-center gap-2 text-sm">
      <span>{text}</span>
      <button
        className="px-2 py-1 rounded bg-red-600 text-white disabled:opacity-60"
        onClick={onConfirm}
        disabled={busy}
      >
        {busy ? 'Working…' : confirmLabel}
      </button>
      <button className="px-2 py-1 rounded border" onClick={onCancel} disabled={busy}>
        {cancelLabel}
      </button>
    </div>
  );
}

/* ---------- Component ---------- */
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
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // post-level menu & confirm state
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDeletePost, setConfirmDeletePost] = useState(false);
  const [deletingPost, setDeletingPost] = useState(false);

  const chRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Load + realtime comments
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from('post_comments')
        .select(`
          id, post_id, profile_id, body, images, created_at,
          profiles:profiles!post_comments_profile_id_fkey(display_name)
        `)
        .eq('post_id', post.id)
        .order('created_at', { ascending: true })
        .limit(200);

      if (error) {
        if (!cancelled) setErr(error.message);
        return;
      }

      if (!cancelled) {
        const normalized = (data ?? []).map((c: any): CommentRow => ({
          id: c.id,
          post_id: c.post_id,
          profile_id: c.profile_id,
          body: c.body ?? '',
          images: (c.images ?? []) as string[],
          created_at: c.created_at,
          profiles:
            c.profiles && !Array.isArray(c.profiles)
              ? { display_name: c.profiles.display_name ?? null }
              : { display_name: null },
        }));
        setComments(normalized);
      }
    })();

    const ch = supabase
      .channel(`post_comments:${post.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'post_comments', filter: `post_id=eq.${post.id}` },
        (payload) => {
          const c: any = payload.new;
          const incoming: CommentRow = {
            id: c.id,
            post_id: c.post_id,
            profile_id: c.profile_id,
            body: c.body ?? '',
            images: (c.images ?? []) as string[],
            created_at: c.created_at,
            profiles: { display_name: null },
          };
          setComments((prev) => dedupeById([...prev, incoming]));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'post_comments', filter: `post_id=eq.${post.id}` },
        (payload) => {
          const delId = (payload.old as any)?.id as string | undefined;
          if (delId) setComments((prev) => prev.filter((c) => c.id !== delId));
        }
      )
      .subscribe();

    chRef.current = ch;
    return () => {
      if (chRef.current) {
        supabase.removeChannel(chRef.current);
        chRef.current = null;
      }
      cancelled = true;
    };
  }, [open, post.id]);

  // Delete post flow with confirm
  async function reallyDeletePost() {
    try {
      setDeletingPost(true);
      const { error } = await supabase.from('posts').delete().eq('id', post.id);
      if (error) throw error;
      onDeleted?.();
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to delete.');
    } finally {
      setDeletingPost(false);
      setConfirmDeletePost(false);
      setMenuOpen(false);
    }
  }

  return (
    <article className="rounded border p-3 relative">
      <header className="mb-2 text-sm text-gray-600 flex items-center justify-between">
        <div>
          <span className="font-medium">{post.profiles?.display_name ?? 'Someone'}</span>
          <span className="mx-1">•</span>
          <time dateTime={post.created_at}>{new Date(post.created_at).toLocaleString()}</time>
        </div>

        {me === post.profile_id && (
          <div className="relative">
            <button
              className="px-2 py-1 text-sm border rounded"
              aria-label="Options"
              onClick={() => setMenuOpen((v) => !v)}
            >
              …
            </button>
            {menuOpen && (
              <Kebab
                items={[
                  {
                    label: 'Delete post',
                    action: () => setConfirmDeletePost(true),
                  },
                ]}
                onClose={() => setMenuOpen(false)}
              />
            )}
          </div>
        )}
      </header>

      {post.body && <p className="mb-2 whitespace-pre-wrap">{post.body}</p>}

      {post.images?.length ? (
        <div className="mb-2 space-y-2">
          {post.images.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="" className="rounded w-full object-cover" />
          ))}
        </div>
      ) : null}

      {confirmDeletePost && (
        <ConfirmInline
          text="Delete this post? This can’t be undone."
          onConfirm={reallyDeletePost}
          onCancel={() => setConfirmDeletePost(false)}
          busy={deletingPost}
        />
      )}

      <button className="mt-2 text-sm underline" onClick={() => setOpen((v) => !v)}>
        {open ? 'Hide comments' : `Show comments (${comments.length})`}
      </button>

      {open && (
        <>
          <CommentComposer
            postId={post.id}
            onAdd={(c) => setComments((prev) => dedupeById([...prev, c]))}
            me={me}
          />

          <div className="mt-2 space-y-2">
            {comments.map((c) => (
              <CommentItem
                key={c.id}
                comment={c}
                me={me}
                onDeleted={() => setComments((prev) => prev.filter((x) => x.id !== c.id))}
              />
            ))}
            {err && <p className="text-sm text-amber-700">{err}</p>}
          </div>
        </>
      )}
    </article>
  );
}

/* ---------- Single Comment with kebab + confirm ---------- */
function CommentItem({
  comment,
  me,
  onDeleted,
}: {
  comment: CommentRow;
  me: string | null;
  onDeleted: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function reallyDelete() {
    try {
      setBusy(true);
      const { error } = await supabase.from('post_comments').delete().eq('id', comment.id);
      if (error) throw error;
      onDeleted();
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to delete comment.');
    } finally {
      setBusy(false);
      setConfirmDel(false);
      setMenuOpen(false);
    }
  }

  return (
    <div className="rounded border p-2 relative">
      <div className="text-xs text-gray-600 mb-1 flex items-center justify-between">
        <div>
          <span className="font-medium">{comment.profiles?.display_name ?? 'Someone'}</span>
          <span className="mx-1">•</span>
          <time dateTime={comment.created_at}>
            {new Date(comment.created_at).toLocaleString()}
          </time>
        </div>

        {me === comment.profile_id && (
          <div className="relative">
            <button
              className="px-2 py-1 text-sm border rounded"
              aria-label="Options"
              onClick={() => setMenuOpen((v) => !v)}
            >
              …
            </button>
            {menuOpen && (
              <Kebab
                items={[
                  {
                    label: 'Delete comment',
                    action: () => setConfirmDel(true),
                  },
                ]}
                onClose={() => setMenuOpen(false)}
              />
            )}
          </div>
        )}
      </div>

      {comment.body && <p className="whitespace-pre-wrap">{comment.body}</p>}

      {comment.images?.length ? (
        <div className="mt-2 space-y-2">
          {comment.images.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="" className="rounded w-full object-cover" />
          ))}
        </div>
      ) : null}

      {confirmDel && (
        <ConfirmInline
          text="Delete this comment? This can’t be undone."
          onConfirm={reallyDelete}
          onCancel={() => setConfirmDel(false)}
          busy={busy}
        />
      )}
      {err && <p className="mt-1 text-sm text-amber-700">{err}</p>}
    </div>
  );
}

/* ---------- Comment Composer ---------- */
function CommentComposer({
  postId,
  me,
  onAdd,
}: {
  postId: string;
  me: string | null;
  onAdd: (c: CommentRow) => void;
}) {
  const [text, setText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function upload(files: FileList) {
    const next: string[] = [];
    const owner = me ?? 'anon';
    for (const f of Array.from(files)) {
      const key = `${owner}/c-${Date.now()}-${f.name}`;
      const { error } = await supabase.storage.from('post-media').upload(key, f);
      if (error) throw error;
      const { data: pub } = supabase.storage.from('post-media').getPublicUrl(key);
      next.push(pub.publicUrl);
    }
    setImages((p) => [...p, ...next].slice(0, 6));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  async function submit() {
    if (busy || !me) return;
    setBusy(true);
    setErr(null);
    try {
      const bodyClean = text.trim() ? text : '';

      const { data, error } = await supabase
        .from('post_comments')
        .insert({
          post_id: postId,
          profile_id: me,
          body: bodyClean, // never null
          images,
        })
        .select(`
          id, post_id, profile_id, body, images, created_at,
          profiles:profiles!post_comments_profile_id_fkey(display_name)
        `)
        .single();

      if (error) throw error;

      const c: CommentRow = {
        id: data.id,
        post_id: data.post_id,
        profile_id: data.profile_id,
        body: data.body ?? '',
        images: (data.images ?? []) as string[],
        created_at: data.created_at,
        profiles:
          data.profiles && !Array.isArray(data.profiles)
            ? { display_name: (data.profiles as { display_name: string | null }).display_name ?? null }
            : { display_name: null },
      };

      // Optimistic add – deduped vs realtime echo
      onAdd(c);
      setText('');
      setImages([]);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to comment.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-start gap-2">
        <textarea
          className="flex-1 rounded border p-2"
          rows={2}
          placeholder="Write a comment…"
          value={text}
          disabled={busy}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className="flex flex-col gap-2 items-end">
          <label className="inline-flex items-center gap-2">
            <span className="px-2 py-1 border rounded cursor-pointer">Add image</span>
            <input type="file" accept="image/*" hidden onChange={(e) => e.target.files && upload(e.target.files)} />
          </label>
          <button className="px-3 py-1 rounded bg-black text-white disabled:opacity-60" disabled={busy} onClick={submit}>
            {busy ? 'Posting…' : 'Post'}
          </button>
        </div>
      </div>

      {images.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {images.map((src) => (
            <div key={src} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-16 w-24 object-cover rounded" />
              <button
                type="button"
                className="absolute -top-2 -right-2 text-xs bg-black/70 text-white rounded-full px-1"
                onClick={() => setImages((prev) => prev.filter((x) => x !== src))}
                aria-label="Remove image"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="text-xs text-gray-500">Enter = Post • Shift+Enter = newline • Up to 6 images</div>
      {err && <p className="text-sm text-red-600">{err}</p>}
    </div>
  );
}
