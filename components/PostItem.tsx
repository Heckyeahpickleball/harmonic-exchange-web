'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type PostRow = {
  id: string;
  profile_id: string;
  body: string | null;
  created_at: string;
  images?: string[] | null;
  profiles?: { display_name: string | null } | null;
};

type CommentRow = {
  id: string;
  post_id: string;
  profile_id: string;
  body: string | null;
  created_at: string;
  images?: string[] | null;
  profiles?: { display_name: string | null } | null;
};

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
        .select('id,post_id,profile_id,body,created_at,images,profiles(display_name)')
        .eq('post_id', post.id)
        .order('created_at', { ascending: true })
        .limit(200);
      if (error) setErr(error.message);
      else setComments((data || []) as CommentRow[]);
    }
  }

  async function deletePost() {
    if (!confirm('Delete this post?')) return;
    const { error } = await supabase.from('posts').delete().eq('id', post.id);
    if (!error) onDeleted();
  }

  function onCommentPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = Array.from(e.clipboardData?.items || []);
    const imgs = items
      .filter((it) => it.kind === 'file' && it.type.startsWith('image/'))
      .map((it) => it.getAsFile())
      .filter(Boolean) as File[];
    if (!imgs.length) return;
    const next = [...files, ...imgs].slice(0, 4);
    setFiles(next);
    setPreviews((prev) => [...prev, ...imgs.map((x) => URL.createObjectURL(x))].slice(0, 4));
  }

  function onCommentFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const f = Array.from(e.currentTarget.files || []);
    const next = [...files, ...f].slice(0, 4);
    setFiles(next);
    setPreviews((prev) => [...prev, ...f.map((x) => URL.createObjectURL(x))].slice(0, 4));
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
        .insert({ post_id: post.id, profile_id: uid, body: body || ' ', images: imageUrls })
        .select('id,post_id,profile_id,body,created_at,images,profiles(display_name)')
        .single();

      if (error) throw error;
      setComments((prev) => [...prev, data as CommentRow]);
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

  function onCommentKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addComment();
    }
  }

  const ownerName = post.profiles?.display_name || 'Someone';

  const images = Array.isArray(post.images) ? post.images : [];
  const colClass = images.length >= 3 ? 'grid-cols-3' : images.length === 2 ? 'grid-cols-2' : 'grid-cols-1';

  return (
    <article className="rounded border p-3">
      <div className="flex items-start justify-between">
        <div className="text-sm">
          <div className="font-medium">{ownerName}</div>
          <div className="text-xs text-gray-500">{new Date(post.created_at).toLocaleString()}</div>
        </div>

        {me === post.profile_id && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded px-2 py-1 text-gray-500 hover:bg-gray-50"
              aria-label="Post menu"
            >
              ⋯
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-10 w-36 rounded border bg-white py-1 text-sm shadow">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    deletePost();
                  }}
                  className="block w-full px-3 py-1 text-left hover:bg-gray-50"
                >
                  Delete post
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {post.body && <p className="mt-2 whitespace-pre-wrap">{post.body}</p>}

      {images.length > 0 && (
        <div className={`mt-2 grid ${colClass} gap-2`}>
          {images.map((src, i) => (
            <div key={i} className="overflow-hidden rounded border">
              <img src={src} alt="" className="h-40 w-full object-cover" />
            </div>
          ))}
        </div>
      )}

      {/* comments toggle */}
      <div className="mt-3 text-xs">
        <button className="underline" onClick={toggleComments}>
          {commentsOpen ? 'Hide comments' : `Show comments (${commentCount})`}
        </button>
      </div>

      {/* comments list */}
      {commentsOpen && (
        <div className="mt-2 space-y-2">
          {comments.map((c) => (
            <div key={c.id} className="rounded border px-3 py-2">
              <div className="flex items-start justify-between">
                <div className="text-sm">
                  <span className="font-medium">{c.profiles?.display_name || 'Someone'}</span>{' '}
                  <span className="text-xs text-gray-500">
                    • {new Date(c.created_at).toLocaleString()}
                  </span>
                </div>

                {/* comment 3-dot menu, only owner can delete */}
                {me === c.profile_id && (
                  <CommentMenu onDelete={() => deleteComment(c.id)} />
                )}
              </div>

              {c.body && <p className="mt-1 whitespace-pre-wrap">{c.body}</p>}

              {Array.isArray(c.images) && c.images.length > 0 && (
                <div className={`mt-2 grid ${c.images.length >= 3 ? 'grid-cols-3' : c.images.length === 2 ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
                  {c.images.map((src, i) => (
                    <div key={i} className="overflow-hidden rounded border">
                      <img src={src} alt="" className="h-28 w-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* add comment */}
          <div className="rounded border p-2">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={onCommentKey}
              onPaste={onCommentPaste}
              rows={2}
              className="w-full resize-none rounded border px-2 py-1"
              placeholder="Write a comment…"
            />

            {/* comment image previews */}
            {previews.length > 0 && (
              <div className="mt-2 grid grid-cols-4 gap-2">
                {previews.map((u, i) => (
                  <div key={i} className="relative overflow-hidden rounded border">
                    <img src={u} alt="" className="h-20 w-full object-cover" />
                    <button
                      type="button"
                      className="absolute right-1 top-1 rounded bg-black/60 px-1 text-xs text-white"
                      onClick={() => {
                        URL.revokeObjectURL(previews[i]);
                        setPreviews((p) => p.filter((_, idx) => idx !== i));
                        setFiles((p) => p.filter((_, idx) => idx !== i));
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="rounded border px-2 py-1 text-sm"
                >
                  Add images
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={onCommentFiles}
                />
                <span className="text-xs text-gray-500">Enter = Comment · Shift+Enter = newline · Up to 4 images</span>
              </div>
              <button
                onClick={addComment}
                disabled={busy}
                className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                {busy ? 'Posting…' : 'Post'}
              </button>
            </div>

            {err && <p className="mt-2 text-sm text-amber-700">{err}</p>}
          </div>
        </div>
      )}
    </article>
  );
}

/** small inline menu for comment delete */
function CommentMenu({ onDelete }: { onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded px-2 py-1 text-gray-500 hover:bg-gray-50"
        aria-label="Comment menu"
      >
        ⋯
      </button>
      {open && (
        <div className="absolute right-0 z-10 w-36 rounded border bg-white py-1 text-sm shadow">
          <button
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            className="block w-full px-3 py-1 text-left hover:bg-gray-50"
          >
            Delete comment
          </button>
        </div>
      )}
    </div>
  );
}
