// components/PostItem.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import {
  notifyOnNewComment,
  notifyOnHeartPost,
  notifyOnHeartComment,
} from '@/lib/notify';

type ProfileLite = {
  display_name: string | null;
  avatar_url?: string | null;
} | null;

type PostRow = {
  id: string;
  profile_id: string;
  body: string | null;
  images?: string[] | null;
  created_at: string;
  profiles?: ProfileLite;
};

type CommentRow = {
  id: string;
  post_id: string;
  profile_id: string;
  body: string | null;
  images?: string[] | null;
  created_at: string;
  profiles?: ProfileLite;
};

function Kebab({
  items,
  onClose,
}: { items: Array<{ label: string; action: () => void }>; onClose: () => void }) {
  return (
    <div className="absolute right-0 z-10 mt-1 w-36 rounded border bg-white shadow">
      {items.map((it, i) => (
        <button
          key={i}
          className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
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
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  busy?: boolean;
}) {
  const [ready, setReady] = useState(false);
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      setReady(true);
      confirmBtnRef.current?.focus();
    }, 0);
    return () => clearTimeout(t);
  }, []);
  return (
    <div role="dialog" aria-modal="true" className="mt-2 rounded-lg border bg-white p-3 shadow-sm">
      <h3 className="mb-2 text-sm font-semibold">Confirm delete</h3>
      <p className="mb-3 text-sm text-gray-700">{text}</p>
      <div className="flex items-center gap-2">
        <button
          ref={confirmBtnRef}
          className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          onClick={onConfirm}
          disabled={!!busy || !ready}
        >
          {busy ? 'Working…' : confirmLabel}
        </button>
        <button
          className="rounded border px-3 py-1.5 text-sm font-medium disabled:opacity-60"
          onClick={onCancel}
          disabled={!!busy}
        >
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}

function normalizeProfile<T extends { profiles?: any }>(row: T) {
  const p = row.profiles;
  return { ...row, profiles: Array.isArray(p) ? (p[0] ?? null) : (p ?? null) };
}
function byCreatedAtAsc<A extends { created_at: string }>(a: A, b: A) {
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

/** Resolve avatar URL even if it's a storage path (tries common buckets). */
function resolveAvatarUrl(raw?: string | null): string | null {
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;

  // Try common buckets where avatars might be stored.
  try {
    const a = supabase.storage.from('avatars').getPublicUrl(raw).data.publicUrl;
    if (a) return a;
  } catch {}
  try {
    const b = supabase.storage.from('profile-images').getPublicUrl(raw).data.publicUrl;
    if (b) return b;
  } catch {}
  return raw; // last resort
}

/** Tiny avatar (image or initials fallback), always clickable */
function TinyAvatar({
  name,
  href,
  src,
  size = 36,
}: {
  name: string;
  href: string;
  src?: string | null;
  size?: number;
}) {
  const resolved = resolveAvatarUrl(src);
  const initials =
    (name || 'S')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || 'S';

  const dimension = `${size}px`;

  if (resolved) {
    return (
      <Link href={href} className="shrink-0" aria-label={`${name}'s profile`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolved}
          alt=""
          className="rounded-full object-cover"
          style={{ width: dimension, height: dimension }}
        />
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className="grid place-items-center shrink-0 rounded-full bg-gray-300 text-xs font-semibold"
      style={{ width: dimension, height: dimension }}
      aria-label={`${name}'s profile`}
      title={name}
    >
      {initials}
    </Link>
  );
}

/* ---------------- Hearts helpers (shared) ---------------- */

type TargetType = 'post' | 'comment';

async function fetchHeartState(targetType: TargetType, targetId: string, me: string | null) {
  // Count
  const { count } = await supabase
    .from('hearts')
    .select('id', { head: true, count: 'exact' })
    .eq('target_type', targetType)
    .eq('target_id', targetId);

  // Mine?
  let iHearted = false;
  if (me) {
    const { data: mine } = await supabase
      .from('hearts')
      .select('id')
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .eq('profile_id', me)
      .maybeSingle();
    iHearted = !!mine;
  }

  return { count: count || 0, iHearted };
}

function useHeartsRealtime(targetType: TargetType, targetId: string, setCount: (n: number) => void) {
  useEffect(() => {
    const channel = supabase
      .channel(`hearts:${targetType}:${targetId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hearts',
          filter: `target_type=eq.${targetType},target_id=eq.${targetId}`,
        },
        async () => {
          // Re-count on any change for robustness
          const { count } = await supabase
            .from('hearts')
            .select('id', { head: true, count: 'exact' })
            .eq('target_type', targetType)
            .eq('target_id', targetId);
          setCount(count || 0);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [targetType, targetId, setCount]);
}

async function toggleHeart(targetType: TargetType, targetId: string, me: string | null) {
  if (!me) throw new Error('NOT_SIGNED_IN');
  // Try to insert; if unique constraint hits, fall back to delete
  const ins = await supabase
    .from('hearts')
    .insert({ target_type: targetType, target_id: targetId, profile_id: me });
  if (ins.error) {
    // If duplicate, delete to "unheart"
    const del = await supabase
      .from('hearts')
      .delete()
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .eq('profile_id', me);
    if (del.error) throw del.error;
    return { action: 'unheart' as const };
  }
  return { action: 'heart' as const };
}

/* ---------------- Main PostItem ---------------- */

export default function PostItem({
  post,
  me,
  onDeleted,
}: {
  post: PostRow;
  me: string | null;
  onDeleted: () => void;
}) {
  const router = useRouter();

  const [menuOpen, setMenuOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [commentText, setCommentText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const [commentCount, setCommentCount] = useState<number>(0);
  const commentIdsRef = useRef<Set<string>>(new Set());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Hearts (post)
  const [postHearts, setPostHearts] = useState(0);
  const [iHeartedPost, setIHeartedPost] = useState(false);

  useEffect(() => {
    (async () => {
      const { count } = await supabase
        .from('post_comments')
        .select('id', { head: true, count: 'exact' })
        .eq('post_id', post.id);
      setCommentCount(count || 0);
    })();
  }, [post.id]);

  // Initial hearts fetch for post
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await fetchHeartState('post', post.id, me);
      if (!cancelled) {
        setPostHearts(s.count);
        setIHeartedPost(s.iHearted);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [post.id, me]);

  // Realtime hearts for post
  useHeartsRealtime('post', post.id, setPostHearts);

  useEffect(() => {
    if (!commentsOpen) {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      return;
    }
    const ch = supabase
      .channel(`post_comments:${post.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'post_comments', filter: `post_id=eq.${post.id}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = normalizeProfile(payload.new as CommentRow) as CommentRow;
            if (commentIdsRef.current.has(row.id)) return; // de-dupe
            commentIdsRef.current.add(row.id);
            setComments((prev) => [...prev, row].sort(byCreatedAtAsc));
            setCommentCount((c) => c + 1);
          } else if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as { id: string };
            if (commentIdsRef.current.has(oldRow.id)) commentIdsRef.current.delete(oldRow.id);
            setComments((prev) => prev.filter((c) => c.id !== oldRow.id));
            setCommentCount((c) => Math.max(0, c - 1));
          } else if (payload.eventType === 'UPDATE') {
            const row = normalizeProfile(payload.new as CommentRow) as CommentRow;
            setComments((prev) => prev.map((c) => (c.id === row.id ? row : c)));
          }
        }
      )
      .subscribe();
    channelRef.current = ch;
    return () => {
      if (ch) supabase.removeChannel(ch);
    };
  }, [commentsOpen, post.id]);

  async function toggleComments() {
    const open = !commentsOpen;
    setCommentsOpen(open);
    setErr('');
    if (open && comments.length === 0) {
      const { data, error } = await supabase
        .from('post_comments')
        .select('id, post_id, profile_id, body, created_at, images, profiles(display_name,avatar_url)')
        .eq('post_id', post.id)
        .order('created_at', { ascending: true })
        .limit(200);
      if (error) setErr(error.message);
      else {
        const normalized: CommentRow[] = (data || []).map((r: any) => normalizeProfile(r));
        setComments(normalized);
        commentIdsRef.current = new Set((normalized || []).map((r) => r.id));
      }
    }
  }

  async function deletePost() {
    if (!confirm('Delete this post?')) return;
    const { error } = await supabase.from('posts').delete().eq('id', post.id);
    if (!error) onDeleted();
  }

  function onCommentPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const imgs = Array.from(e.clipboardData?.items || [])
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
      urls.push(bucket.getPublicUrl(path).data.publicUrl);
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
        .insert({ post_id: post.id, profile_id: uid, body: body || ' ', images: imageUrls })
        .select('id, post_id, profile_id, body, created_at, images, profiles(display_name,avatar_url)')
        .single();
      if (error) throw error;
      const normalized = normalizeProfile(data) as CommentRow;

      // mark seen to prevent realtime duplicate
      commentIdsRef.current.add(normalized.id);

      setComments((prev) => [...prev, normalized].sort(byCreatedAtAsc));
      setCommentCount((c) => c + 1);
      setCommentText('');
      previews.forEach((u) => URL.revokeObjectURL(u));
      setFiles([]);
      setPreviews([]);

      // 🔔 Notify the post author about the new comment
      const myName =
        (normalized?.profiles?.display_name as string | null) ?? null; // best available
      await notifyOnNewComment({
        postId: post.id,
        postAuthorId: post.profile_id,
        commenterName: myName ?? undefined,
        commentText: body || undefined,
      });
    } catch (e: any) {
      setErr(e?.message ?? 'Could not comment.');
    } finally {
      setBusy(false);
    }
  }

  function onComposerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!busy) addComment();
    }
  }

  const toggleLabel = commentsOpen ? `Hide comments (${commentCount})` : `See comments (${commentCount})`;

  // Decide grid columns for post images:
  const postImgCount = post.images?.length ?? 0;
  const postGridCols =
    postImgCount <= 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2';

  const authorName = post.profiles?.display_name ?? 'Someone';
  const authorAvatar = post.profiles?.avatar_url ?? null;
  const authorHref = `/u/${post.profile_id}`;

  async function onToggleHeartPost() {
    try {
      const res = await supabase.auth.getUser();
      const meId = res.data.user?.id ?? null;

      const result = await toggleHeart('post', post.id, meId);
      setIHeartedPost(result.action === 'heart');
      // Optimistic count adjustment (realtime will correct if needed)
      setPostHearts((n) => n + (result.action === 'heart' ? 1 : -1));

      // 🔔 Notify post author when hearted
      if (result.action === 'heart') {
        // (Optional) fetch my display name for nicer copy — non-blocking
        let likerName: string | null = null;
        try {
          if (meId) {
            const { data: meProf } = await supabase
              .from('profiles')
              .select('display_name')
              .eq('id', meId)
              .maybeSingle();
            likerName = meProf?.display_name ?? null;
          }
        } catch {}
        await notifyOnHeartPost({
          postId: post.id,
          postAuthorId: post.profile_id,
          likerName: likerName ?? undefined,
        });
      }
    } catch (e: any) {
      if (String(e?.message) === 'NOT_SIGNED_IN') {
        router.push('/signin');
        return;
      }
      console.error(e);
    }
  }

  return (
    <article className="hx-card p-3">
      <header className="mb-2 flex items-center justify-between text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <TinyAvatar name={authorName} href={authorHref} src={authorAvatar} />
          <div>
            <Link href={authorHref} className="font-medium underline">
              {authorName}
            </Link>
            <span className="mx-1">•</span>
            <time dateTime={post.created_at}>{new Date(post.created_at).toLocaleString()}</time>
          </div>
        </div>

        {/* Post actions: delete + hearts */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleHeartPost}
            className={[
              'inline-flex items-center gap-1 rounded border px-2 py-1 text-sm',
              iHeartedPost ? 'bg-pink-50 border-pink-300 text-pink-700' : '',
            ].join(' ')}
            title={iHeartedPost ? 'Unheart' : 'Heart'}
            aria-pressed={iHeartedPost}
          >
            <span aria-hidden>❤️</span>
            <span>{postHearts}</span>
          </button>

          {me === post.profile_id && (
            <div className="relative">
              <button
                className="rounded border px-2 py-1 text-sm"
                aria-label="More actions"
                onClick={() => setMenuOpen((v) => !v)}
              >
                …
              </button>
              {menuOpen && (
                <Kebab
                  items={[{ label: 'Delete post', action: deletePost }]}
                  onClose={() => setMenuOpen(false)}
                />
              )}
            </div>
          )}
        </div>
      </header>

      {post.body && <p className="mb-2 whitespace-pre-wrap">{post.body}</p>}

      {/* IMAGES: natural height; single image spans full width on desktop */}
      {post.images?.length ? (
        <div className={`mb-2 grid ${postGridCols} gap-2`}>
          {post.images.map((src) => (
            <figure key={src} className="w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="w-full h-auto rounded" />
            </figure>
          ))}
        </div>
      ) : null}

      <button className="text-sm underline" onClick={toggleComments}>
        {toggleLabel}
      </button>

      {commentsOpen && (
        <>
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
                onKeyDown={onComposerKeyDown}
              />
              <div className="flex flex-col items-end gap-2">
                <label className="inline-flex items-center gap-2">
                  <span className="cursor-pointer rounded border px-2 py-1">Add image</span>
                  <input ref={fileRef} type="file" accept="image/*" hidden multiple onChange={onCommentFiles} />
                </label>
                <button className="rounded bg-black px-3 py-1 text-white disabled:opacity-60" disabled={busy} onClick={addComment}>
                  {busy ? 'Posting…' : 'Post'}
                </button>
              </div>
            </div>

            {previews.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {previews.map((src, idx) => (
                  <div key={src} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="h-16 w-24 rounded object-cover" />
                    <button
                      type="button"
                      className="absolute -right-2 -top-2 rounded-full bg-black/70 px-1 text-xs text-white"
                      onClick={() => {
                        URL.revokeObjectURL(src);
                        setPreviews((prev) => prev.filter((x) => x !== src));
                        setFiles((prev) => prev.filter((_, i) => i !== idx));
                      }}
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

          <div className="mt-3 space-y-2">
            {comments.map((c) => (
              <CommentItem
                key={c.id}
                comment={c}
                me={me}
                ownerId={post.profile_id}
                onDeleted={() => {
                  setComments((prev) => prev.filter((x) => x.id !== c.id));
                  setCommentCount((n) => Math.max(0, n - 1));
                  if (commentIdsRef.current.has(c.id)) commentIdsRef.current.delete(c.id);
                }}
              />
            ))}
          </div>
        </>
      )}
    </article>
  );
}

/* ---------------- CommentItem (with hearts) ---------------- */

function CommentItem({
  comment,
  me,
  ownerId,
  onDeleted,
}: {
  comment: CommentRow;
  me: string | null;
  ownerId: string;
  onDeleted: () => void;
}) {
  const router = useRouter();

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canDelete = !!me && (me === comment.profile_id || me === ownerId);

  // Hearts (comment)
  const [hearts, setHearts] = useState(0);
  const [iHearted, setIHearted] = useState(false);

  // Initial heart state
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await fetchHeartState('comment', comment.id, me);
      if (!cancelled) {
        setHearts(s.count);
        setIHearted(s.iHearted);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [comment.id, me]);

  // Realtime heart count
  useHeartsRealtime('comment', comment.id, setHearts);

  async function onToggleHeartComment() {
    try {
      const res = await supabase.auth.getUser();
      const meId = res.data.user?.id ?? null;

      const result = await toggleHeart('comment', comment.id, meId);
      setIHearted(result.action === 'heart');
      setHearts((n) => n + (result.action === 'heart' ? 1 : -1));

      // 🔔 Notify comment author when hearted
      if (result.action === 'heart') {
        let likerName: string | null = null;
        try {
          if (meId) {
            const { data: meProf } = await supabase
              .from('profiles')
              .select('display_name')
              .eq('id', meId)
              .maybeSingle();
            likerName = meProf?.display_name ?? null;
          }
        } catch {}
        await notifyOnHeartComment({
          commentId: comment.id,
          commentAuthorId: comment.profile_id,
          postId: comment.post_id,
          likerName: likerName ?? undefined,
        });
      }
    } catch (e: any) {
      if (String(e?.message) === 'NOT_SIGNED_IN') {
        router.push('/signin');
        return;
      }
      console.error(e);
    }
  }

  // Decide grid columns for comment images:
  const cImgCount = comment.images?.length ?? 0;
  const commentGridCols =
    cImgCount <= 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2';

  const commenterName = comment.profiles?.display_name ?? 'Someone';
  const commenterAvatar = comment.profiles?.avatar_url ?? null;
  const commenterHref = `/u/${comment.profile_id}`;

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
    <div className="relative rounded border p-2">
      <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <TinyAvatar name={commenterName} href={commenterHref} src={commenterAvatar} />
          <div>
            <Link href={commenterHref} className="font-medium underline">
              {commenterName}
            </Link>
            <span className="mx-1">•</span>
            <time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleString()}</time>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleHeartComment}
            className={[
              'inline-flex items-center gap-1 rounded border px-2 py-1 text-xs',
              iHearted ? 'bg-pink-50 border-pink-300 text-pink-700' : '',
            ].join(' ')}
            title={iHearted ? 'Unheart' : 'Heart'}
            aria-pressed={iHearted}
          >
            <span aria-hidden>❤️</span>
            <span>{hearts}</span>
          </button>

          {canDelete && (
            <div className="relative">
              <button
                className="rounded border px-2 py-1 text-sm"
                aria-label="More actions"
                onClick={() => setMenuOpen((v) => !v)}
              >
                …
              </button>
              {menuOpen && (
                <Kebab
                  items={[{ label: 'Delete comment', action: () => setConfirmDel(true) }]}
                  onClose={() => setMenuOpen(false)}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {comment.body && <p className="whitespace-pre-wrap">{comment.body}</p>}

      {/* Comment images: single image spans full width on desktop */}
      {comment.images?.length ? (
        <div className={`mt-2 grid ${commentGridCols} gap-2`}>
          {comment.images.map((src) => (
            <figure key={src} className="w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="w-full h-auto rounded" />
            </figure>
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
