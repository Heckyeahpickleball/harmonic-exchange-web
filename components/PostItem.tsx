// components/PostItem.tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type PostRow = {
  id: string;
  profile_id: string;
  body: string;
  images: string[];
  created_at: string;
  profiles?: { display_name: string | null } | null;
};

type CommentRow = {
  id: string;
  post_id: string;
  profile_id: string;
  body: string;
  images: string[]; // text[]
  created_at: string;
  profiles?: { display_name: string | null } | null;
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
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const subRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

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

      if (error) setErr(error.message);
      else if (!cancelled) {
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

    // realtime for comments on this post
    const ch = supabase
      .channel(`post_comments:${post.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'post_comments', filter: `post_id=eq.${post.id}` },
        (payload) => {
          const c: any = payload.new;
          const row: CommentRow = {
            id: c.id,
            post_id: c.post_id,
            profile_id: c.profile_id,
            body: c.body ?? '',
            images: (c.images ?? []) as string[],
            created_at: c.created_at,
            profiles: { display_name: null }, // small optimistic default
          };
          setComments((prev) => [...prev, row]);
        }
      )
      .subscribe();
    subRef.current = ch;

    return () => {
      cancelled = true;
      if (subRef.current) {
        supabase.removeChannel(subRef.current);
        subRef.current = null;
      }
    };
  }, [open, post.id]);

  async function deletePost() {
    if (!confirm('Delete this post?')) return;
    const { error } = await supabase.from('posts').delete().eq('id', post.id);
    if (!error) onDeleted?.();
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
          <button className="px-2 py-1 text-sm border rounded" onClick={deletePost}>
            …
          </button>
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

      <button className="text-sm underline" onClick={() => setOpen((v) => !v)}>
        {open ? 'Hide comments' : `Show comments (${comments.length})`}
      </button>

      {open && (
        <CommentComposer
          postId={post.id}
          onAdd={(c) => setComments((prev) => [...prev, c])}
          me={me}
        />
      )}

      {open && (
        <div className="mt-2 space-y-2">
          {comments.map((c) => (
            <div key={c.id} className="rounded border p-2">
              <div className="text-xs text-gray-600 mb-1">
                <span className="font-medium">{c.profiles?.display_name ?? 'Someone'}</span>
                <span className="mx-1">•</span>
                <time dateTime={c.created_at}>
                  {new Date(c.created_at).toLocaleString()}
                </time>
              </div>
              {c.body && <p className="whitespace-pre-wrap">{c.body}</p>}
              {c.images?.length ? (
                <div className="mt-2 space-y-2">
                  {c.images.map((src) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={src} src={src} alt="" className="rounded w-full object-cover" />
                  ))}
                </div>
              ) : null}
            </div>
          ))}
          {err && <p className="text-sm text-amber-700">{err}</p>}
        </div>
      )}
    </article>
  );
}

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
          body: bodyClean,     // never null
          images,              // text[]
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
  );
}
