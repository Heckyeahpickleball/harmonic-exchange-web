'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';

type PostRow = {
  id: string;
  profile_id: string;
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
          onClick={() => { it.action(); onClose(); }}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

function ConfirmInline({
  text, confirmLabel = 'Delete', cancelLabel = 'Cancel', onConfirm, onCancel, busy,
}: {
  text: string; confirmLabel?: string; cancelLabel?: string;
  onConfirm: () => void | Promise<void>; onCancel: () => void; busy?: boolean;
}) {
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { const t = setTimeout(() => confirmBtnRef.current?.focus(), 0); return () => clearTimeout(t); }, []);
  return (
    <div role="dialog" aria-modal="true" className="mt-2 rounded-lg border bg-white p-3 shadow-sm">
      <h3 className="mb-2 text-sm font-semibold">Confirm delete</h3>
      <p className="mb-3 text-sm text-gray-700">{text}</p>
      <div className="flex items-center gap-2">
        <button
          ref={confirmBtnRef}
          className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          onClick={onConfirm}
          disabled={!!busy}
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
  return { ...row, profiles: Array.isArray(p) ? (p[0] ?? null) : p ?? null };
}
function byCreatedAtAsc<A extends { created_at: string }>(a: A, b: A) {
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

export default function PostItem({
  post, me, onDeleted,
}: { post: PostRow; me: string | null; onDeleted: () => void; }) {
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

  useEffect(() => {
    (async () => {
      const { count } = await supabase
        .from('post_comments')
        .select('id', { head: true, count: 'exact' })
        .eq('post_id', post.id);
      setCommentCount(count || 0);
    })();
  }, [post.id]);

  useEffect(() => {
    if (!commentsOpen) { if (channelRef.current) supabase.removeChannel(channelRef.current); return; }
    const ch = supabase
      .channel(`post_comments:${post.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_comments', filter: `post_id=eq.${post.id}` },
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
        })
      .subscribe();
    channelRef.current = ch;
    return () => { if (ch) supabase.removeChannel(ch); };
  }, [commentsOpen, post.id]);

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
      const { error } = await bucket.upload(path, f, { cacheControl: '3600', upsert: true, contentType: f.type || 'image/*' });
      if (error) throw error;
      urls.push(bucket.getPublicUrl(path).data.publicUrl);
    }
    return urls;
  }

  async function addComment() {
    const body = commentText.trim();
    if (!body && files.length === 0) return;
    setBusy(true); setErr('');
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error('Not signed in');
      const imageUrls = await uploadAllImages(uid, files);
      const { data, error } = await supabase
        .from('post_comments')
        .insert({ post_id: post.id, profile_id: uid, body: body || ' ', images: imageUrls })
        .select('id, post_id, profile_id, body, created_at, images, profiles(display_name)')
        .single();
      if (error) throw error;
      const normalized = normalizeProfile(data) as CommentRow;

      // mark seen to prevent realtime duplicate
      commentIdsRef.current.add(normalized.id);

      setComments((prev) => [...prev, normalized].sort(byCreatedAtAsc));
      setCommentCount((c) => c + 1);
      setCommentText(''); previews.forEach((u) => URL.revokeObjectURL(u)); setFiles([]); setPreviews([]);
    } catch (e: any) { setErr(e?.message ?? 'Could not comment.'); }
    finally { setBusy(false); }
  }

  function onComposerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!busy) addComment(); }
  }

  const toggleLabel = commentsOpen ? `Hide comments (${commentCount})` : `See comments (${commentCount})`;

  return (
    <article className="hx-card p-3">
      <header className="mb-2 flex items-center justify-between text-sm text-gray-600">
        <div>
          <span className="font-medium">{post.profiles?.display_name ?? 'Someone'}</span>
          <span className="mx-1">•</span>
          <time dateTime={post.created_at}>{new Date(post.created_at).toLocaleString()}</time>
        </div>
        {me === post.profile_id && (
          <div className="relative">
            <button className="rounded border px-2 py-1 text-sm" aria-label="More actions" onClick={() => setMenuOpen((v) => !v)}>…</button>
            {menuOpen && <Kebab items={[{ label: 'Delete post', action: deletePost }]} onClose={() => setMenuOpen(false)} />}
          </div>
        )}
      </header>

      {post.body && <p className="mb-2 whitespace-pre-wrap">{post.body}</p>}

      {post.images?.length ? (
        <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {post.images.map((src) => (
            <div key={src} className="relative h-48 w-full overflow-hidden rounded">
              <Image src={src} alt="" fill className="object-cover" sizes="(max-width: 640px) 100vw, 50vw" />
            </div>
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
                  <input ref={fileRef} type="file" accept="image/*" hidden multiple onChange={onCommentFiles}/>
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

function CommentItem({
  comment, me, ownerId, onDeleted,
}: { comment: CommentRow; me: string | null; ownerId: string; onDeleted: () => void; }) {
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
    <div className="relative rounded border p-2">
      <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
        <div>
          <span className="font-medium">{comment.profiles?.display_name ?? 'Someone'}</span>
          <span className="mx-1">•</span>
          <time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleString()}</time>
        </div>
        {canDelete && (
          <div className="relative">
            <button className="rounded border px-2 py-1 text-sm" aria-label="More actions" onClick={() => setMenuOpen((v) => !v)}>…</button>
            {menuOpen && <Kebab items={[{ label: 'Delete comment', action: () => setConfirmDel(true) }]} onClose={() => setMenuOpen(false)} />}
          </div>
        )}
      </div>

      {comment.body && <p className="whitespace-pre-wrap">{comment.body}</p>}
      {comment.images?.length ? (
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {comment.images.map((src) => (
            <div key={src} className="relative h-40 w-full overflow-hidden rounded">
              <Image src={src} alt="" fill className="object-cover" sizes="(max-width: 640px) 100vw, 50vw" />
            </div>
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
