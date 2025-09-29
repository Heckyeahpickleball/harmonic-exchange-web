'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type ProfileLite = { display_name: string | null };
export type PostRow = {
  id: string;
  profile_id: string;
  body: string | null;
  images: string[]; // stored as jsonb[] of URLs
  created_at: string;
  profiles?: ProfileLite | null;
};

type CommentRow = {
  id: string;
  post_id: string;
  profile_id: string;
  body: string | null;
  images: string[];            // jsonb array of strings (urls)
  created_at: string;
  profiles?: ProfileLite | null;
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
  const [err, setErr] = useState<string>('');
  const [open, setOpen] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);

  // comment composer
  const [cText, setCText] = useState('');
  const [cImages, setCImages] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // ---- helpers

  function fmt(ts: string) {
    const d = new Date(ts);
    return d.toLocaleString();
  }

  async function uploadToPostMedia(file: File): Promise<string> {
    if (!me) throw new Error('Not signed in');
    const path = `${me}/${Date.now()}_${file.name}`;
    const up = await supabase.storage.from('post-media').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });
    if (up.error) throw up.error;
    const pub = supabase.storage.from('post-media').getPublicUrl(path);
    return pub.data.publicUrl;
  }

  // ---- load comments once (when opened)
  useEffect(() => {
    let cancelled = false;
    if (!open) return;

    (async () => {
      const { data, error } = await supabase
        .from('post_comments')
        .select(
          `
          id, post_id, profile_id, body, images, created_at,
          profiles:profiles!post_comments_profile_id_fkey ( display_name )
        `
        )
        .eq('post_id', post.id)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        if (!cancelled) setErr(error.message);
      } else {
        // normalize: images -> string[], profiles -> object
        const rows = (data || []).map((r: any) => ({
          ...r,
          images: Array.isArray(r.images)
            ? r.images
            : r.images && typeof r.images === 'object'
            ? r.images
            : [],
          profiles:
            r.profiles && !Array.isArray(r.profiles) ? r.profiles : null,
        })) as CommentRow[];
        if (!cancelled) setComments(rows);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, post.id]);

  // ---- realtime for this post's comments
  useEffect(() => {
    if (!open) return;
    const channel = supabase
      .channel(`comments:${post.id}`)
      .on(
        'postgres_changes',
        { schema: 'public', table: 'post_comments', event: 'INSERT', filter: `post_id=eq.${post.id}` },
        (payload) => {
          const r: any = payload.new;
          const row: CommentRow = {
            ...r,
            images: Array.isArray(r.images) ? r.images : [],
            profiles: (r.profiles && !Array.isArray(r.profiles)) ? r.profiles : null,
          };
          setComments((prev) => {
            // if the exact id already exists, skip
            if (prev.some((c) => c.id === row.id)) return prev;
            return [row, ...prev];
          });
        }
      )
      .on(
        'postgres_changes',
        { schema: 'public', table: 'post_comments', event: 'DELETE', filter: `post_id=eq.${post.id}` },
        (payload) => {
          const r: any = payload.old;
          setComments((prev) => prev.filter((c) => c.id !== r.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, post.id]);

  // ---- comment submit
  const canPostComment = useMemo(
    () => (cText.trim().length > 0) || cImages.length > 0,
    [cText, cImages]
  );

  async function handleCommentSubmit() {
    try {
      setErr('');
      if (!me) throw new Error('Please sign in');
      if (!canPostComment) return;

      // upload all images first
      let urls: string[] = [];
      if (cImages.length) {
        urls = await Promise.all(cImages.map(uploadToPostMedia));
      }

      const bodyVal = cText.trim().length ? cText.trim() : null;

      const { data, error } = await supabase
        .from('post_comments')
        .insert({
          post_id: post.id,
          profile_id: me,
          body: bodyVal,
          images: urls, // jsonb text[] in db
        })
        .select(
          `
          id, post_id, profile_id, body, images, created_at,
          profiles:profiles!post_comments_profile_id_fkey ( display_name )
        `
        )
        .single();

      if (error) throw error;

      const added: CommentRow = {
        ...data,
        images: Array.isArray(data.images) ? data.images : [],
        profiles:
          data.profiles && !Array.isArray(data.profiles) ? data.profiles : null,
      };

      // optimistic (in case realtime is a tick late)
      setComments((prev) => [added, ...prev]);
      setCText('');
      setCImages([]);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  // ---- delete post (owner only UI assumed above)
  async function handleDeletePost() {
    if (!confirm('Delete this post?')) return;
    try {
      setBusyDelete(true);
      const { error } = await supabase.from('posts').delete().eq('id', post.id);
      if (error) throw error;
      onDeleted?.();
    } catch (e: any) {
      alert(e?.message ?? 'Failed to delete post.');
    } finally {
      setBusyDelete(false);
    }
  }

  return (
    <article className="rounded-xl border">
      {/* header */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="text-sm">
          <div className="font-medium">
            {post.profiles?.display_name || 'Someone'}
          </div>
          <div className="text-gray-500">{fmt(post.created_at)}</div>
        </div>

        {/* post menu */}
        {me === post.profile_id && (
          <div className="relative">
            <button
              className="rounded border px-2 py-1 text-xs"
              onClick={handleDeletePost}
              disabled={busyDelete}
              title="Delete post"
            >
              …
            </button>
          </div>
        )}
      </div>

      {/* body */}
      {post.body && <p className="px-4 pb-2 whitespace-pre-wrap">{post.body}</p>}

      {/* images */}
      {Array.isArray(post.images) && post.images.length > 0 && (
        <div className="space-y-2 px-4 pb-2">
          {post.images.map((url, i) => (
            <img
              key={i}
              src={url}
              alt=""
              className="max-h-[420px] w-full rounded-lg object-cover"
              loading="lazy"
            />
          ))}
        </div>
      )}

      {/* comments toggle */}
      <div className="border-t px-4 py-2">
        <button
          className="text-sm underline"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Hide comments' : `Show comments (${comments.length})`}
        </button>
      </div>

      {/* comments list + composer */}
      {open && (
        <div className="space-y-2 border-t px-4 py-3">
          {/* comment thumbnails */}
          {cImages.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {cImages.map((f, idx) => (
                <div key={idx} className="relative">
                  <img
                    src={URL.createObjectURL(f)}
                    alt=""
                    className="h-16 w-16 rounded object-cover"
                  />
                  <button
                    className="absolute -right-2 -top-2 rounded-full border bg-white px-1 text-xs"
                    onClick={() =>
                      setCImages((prev) => prev.filter((_, i) => i !== idx))
                    }
                    aria-label="Remove image"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* composer */}
          <div className="flex items-end gap-2">
            <textarea
              className="w-full rounded border p-2 text-sm"
              placeholder="Write a comment…"
              rows={2}
              value={cText}
              onChange={(e) => setCText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (canPostComment) void handleCommentSubmit();
                }
              }}
            />
            <div className="flex flex-col items-end gap-2">
              <button
                className="rounded border px-2 py-1 text-xs"
                type="button"
                onClick={() => fileRef.current?.click()}
              >
                Add image
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  const files = Array.from(e.currentTarget.files || []);
                  if (files.length) {
                    setCImages((prev) => {
                      const next = [...prev, ...files].slice(0, 6);
                      return next;
                    });
                  }
                  e.currentTarget.value = '';
                }}
              />
              <button
                className="rounded bg-black px-3 py-1 text-xs text-white disabled:opacity-50"
                disabled={!canPostComment}
                onClick={handleCommentSubmit}
              >
                Post
              </button>
              <div className="text-[11px] text-gray-500">
                Enter = Post · Shift+Enter = newline · Up to 6 images
              </div>
            </div>
          </div>

          {err && <p className="text-sm text-amber-700">{err}</p>}

          {/* list */}
          <div className="space-y-2 pt-1">
            {comments.map((c) => (
              <div key={c.id} className="rounded border p-2">
                <div className="mb-1 text-xs text-gray-600">
                  {c.profiles?.display_name || 'Someone'} •{' '}
                  {new Date(c.created_at).toLocaleString()}
                </div>
                {c.body && <p className="whitespace-pre-wrap">{c.body}</p>}
                {Array.isArray(c.images) && c.images.length > 0 && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {c.images.map((u, i) => (
                      <img
                        key={i}
                        src={u}
                        alt=""
                        className="max-h-52 w-full rounded object-cover"
                        loading="lazy"
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
