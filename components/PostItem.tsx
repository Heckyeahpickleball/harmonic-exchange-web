// components/PostItem.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

/* ---------- Types ---------- */
type PostRow = {
  id: string;
  profile_id: string; // post owner
  body: string | null;
  images?: string[] | null;
  created_at: string;
  profiles?: { display_name: string | null } | null;
};

type CommentRow = {
  id: string;
  post_id: string;
  profile_id: string;
  body: string | null;
  images?: string[] | null;
  created_at: string;
  profiles?: { display_name: string | null } | null;
};

/* ---------- Small UI helpers ---------- */
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

/* ---------- Utils ---------- */
function normalizeProfile<T extends { profiles?: any }>(row: T) {
  const p = row.profiles;
  return {
    ...row,
    profiles: Array.isArray(p) ? (p[0] ?? null) : p ?? null,
  };
}

/* ---------- Component ---------- */
export default function PostItem({
  post,
  me,
  onDeleted,
}: {
  post: PostRow;
  me: string | null;
  onDeleted: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [commentText, setCommentText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // comment images
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // accurate count regardless of whether comments are loaded
  const [commentCount, setCommentCount] = useState<number>(0);

  useEffect(() => {
    // initial count
    (async () => {
      const { count, error } = await supabase
        .from('post_comments')
        .select('id', { head: true, count: 'exact' })
        .eq('post_id', post.id);
      if (!error) setCommentCount(count || 0);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);

  async function toggleComments() {
    const open = !commentsOpen;
    setCommentsOpen(open);
    setErr('');

    if (open && comments.length === 0) {
      const { data, error } = await supabase
        .from('post_comments')
        .select('id, post_id, profile_id, body, created_at, images, profiles(display_name)')
        .eq('post_id', post.id)
        .order('created_at', { ascending: true })
        .limit(200);

      if (error) {
        setErr(error.message);
      } else {
        const normalized: CommentRow[] = (data || []).map((r: any) => normalizeProfile(r));
        setComments(normalized);
      }
    }
  }

  async function deletePost() {
    if (!confirm('Delete this post?')) return;
    const { error } = await supabase.from('posts').delete().eq('id', post.id);
    if (!error) onDeleted();
  }

  // ----- comment uploads -----
  function onCommentPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = Array.from(e.clipboardData?.items || []);
    const imgs = items
      .filter((it) => it.kind === 'file' && it.type.startsWith('image/'))
      .map((it) => it.getAsFile())
      .filter(Boolean) as File[];
    if (!imgs.length) return;
    const next = [...files, ...imgs].slice(0, 6);
    setFiles(next);
    setPreviews((prev) => [...prev, ...imgs.map((x) => URL.createObjectURL(x))].slice(0, 6));
  }

  function onCommentFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const f = Array.from(e.currentTarget.files || []);
    const next = [...files, ...f].slice(0, 6);
    setFiles(next);
    setPreviews((prev) => [...prev, ...f.map((x) => URL.createObjectURL(x))].slice(0, 6));
    e.currentTarget.value = '';
  }

  async function uploadAllImages(userId: string, imgs: File[]): Promise<string[]> {
    if (!imgs.length) return [];
    const bucket = supabase.storage.from('post-media');
    const urls: string[] = [];
    for (const f of imgs) {
      const path = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}_${f.name}`;
      const { error } = await bucket.upload(path, f, {
        cacheControl: '3600',
        upsert: true,
        contentType: f.type || 'image/*',
      });
      if (error) throw error;
      const { data } = bucket.getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    return urls;
  }

  async function addComment() {
    const body = commentText.trim();
    if (!body && files.length === 0) return;
    setBusy(true);
    setErr('');
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error('Not signed in');

      const imageUrls = await uploadAllImages(uid, files);

      const { data, error } = await supabase
        .from('post_comments')
        .insert({
          post_id: post.id,
          profile_id: uid,
          body: body || ' ', // allow image-only comments
          images: imageUrls,
        })
        .select('id, post_id, profile_id, body, created_at, images, profiles(display_name)')
        .single();

      if (error) throw error;

      const normalized = normalizeProfile(data);
      setComments((prev) => [...prev, normalized as CommentRow]);
      setCommentCount((c) => c + 1);
      setCommentText('');
      previews.forEach((u) => URL.revokeObjectURL(u));
      setFiles([]);
      setPreviews([]);
    } catch (e: any) {
      setErr(e?.message ?? 'Could not comment.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteComment(id: string) {
    if (!confirm('Delete this comment?')) return;
    const { error } = await supabase.from('post_comments').delete().eq('id', id);
    if (!error) {
      setComments((prev) => prev.filter((c) => c.id !== id));
      setCommentCount((c) => Math.max(0, c - 1));
    }
  }

  return (
    <article className="rounded border p-3">
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
                    action: deletePost,
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

      <button className="text-sm underline" onClick={toggleComments}>
        {commentsOpen ? `Hide comments (${commentCount})` : `Show comments (${commentCount})`}
      </button>

      {commentsOpen && (
        <>
          {/* composer */}
          <div className="mt-2 space-y-2">
            <div className="flex items-start gap-2">
              <textarea
                className="flex-1 rounded border p-2"
                rows={2}
                placeholder="Write a comment…"
                value={commentText}
                disabled={busy}
                onChange={(e) => setCommentText(e.target.value)}
                onPaste={onCommentPaste}
              />
              <div className="flex flex-col gap-2 items-end">
                <label className="inline-flex items-center gap-2">
                  <span className="px-2 py-1 border rounded cursor-pointer">Add image</span>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    hidden
                    multiple
                    onChange={onCommentFiles}
                  />
                </label>
                <button
                  className="px-3 py-1 rounded bg-black text-white disabled:opacity-60"
                  disabled={busy}
                  onClick={addComment}
                >
                  {busy ? 'Posting…' : 'Post'}
                </button>
              </div>
            </div>

            {previews.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {previews.map((src) => (
                  <div key={src} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="h-16 w-24 object-cover rounded" />
                    <button
                      type="button"
                      className="absolute -top-2 -right-2 text-xs bg-black/70 text-white rounded-full px-1"
                      onClick={() => {
                        setPreviews((prev) => prev.filter((x) => x !== src));
                        setFiles((prev) => prev.filter((_, i) => previews[i] !== src));
                      }}
                      aria-label="Remove image"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="text-xs text-gray-500">
              Enter = Post • Shift+Enter = newline • Up to 6 images
            </div>
            {err && <p className="text-sm text-red-600">{err}</p>}
          </div>

          {/* list */}
          <div className="mt-3 space-y-2">
            {comments.map((c) => (
              <CommentItem
                key={c.id}
                comment={c}
                me={me}
                ownerId={post.profile_id} // <— allow post owner to manage
                onDeleted={() => {
                  setComments((prev) => prev.filter((x) => x.id !== c.id));
                  setCommentCount((n) => Math.max(0, n - 1));
                }}
              />
            ))}
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
  ownerId,
  onDeleted,
}: {
  comment: CommentRow;
  me: string | null;
  ownerId: string; // <— new
  onDeleted: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canDelete = !!me && (me === comment.profile_id || me === ownerId);

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

        {canDelete && (
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
      {err && <p className="mt-1 text-sm text-red-600">{err}</p>}
    </div>
  );
}
