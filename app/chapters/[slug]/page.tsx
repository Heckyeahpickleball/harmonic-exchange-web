'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter, notFound } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type GroupStatus = 'pending' | 'active' | 'suspended' | 'archived';
type Group = {
  id: string;
  slug: string;
  name: string;
  about: string | null;
  city: string | null;
  country: string | null;
  status: GroupStatus;
  created_by: string;
  created_at: string;
};

type Member = {
  profile_id: string;
  role: 'anchor' | 'member';
  display_name: string | null;
};

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  is_online: boolean | null;
  rsvp_count?: number;
  i_rsvped?: boolean;
};

type PostRow = {
  id: string;
  created_at: string;
  profile_id: string;
  body: string | null;
  images: string[];          // text[]
  group_id: string | null;
};

type PostPreview = {
  id: string;
  created_at: string;
  author_id: string;
  author_name?: string | null;
  body: string | null;
  image_urls: string[];
};

type OfferPreview = {
  id: string;
  title: string;
  status: 'pending' | 'active' | 'paused' | 'archived' | 'blocked';
  created_at: string;
  owner_id: string;
  owner_name?: string | null;
};

export default function ChapterPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();

  const [meId, setMeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string>('');

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [isAnchor, setIsAnchor] = useState(false);

  const [events, setEvents] = useState<EventRow[]>([]);
  const [posts, setPosts] = useState<PostPreview[]>([]);
  const [offers, setOffers] = useState<OfferPreview[]>([]);
  const [offerQ, setOfferQ] = useState('');

  // Composer (text + images)
  const [postText, setPostText] = useState('');
  const [postFiles, setPostFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // About editor (anchors)
  const [editingAbout, setEditingAbout] = useState(false);
  const [aboutDraft, setAboutDraft] = useState('');

  // Event creation (anchors)
  const [showEventForm, setShowEventForm] = useState(false);
  const [evTitle, setEvTitle] = useState('');
  const [evDesc, setEvDesc] = useState('');
  const [evStart, setEvStart] = useState('');
  const [evEnd, setEvEnd] = useState('');
  const [evOnline, setEvOnline] = useState(false);
  const [evLocation, setEvLocation] = useState('');
  const [creatingEvent, setCreatingEvent] = useState(false);

  // --- helpers
  function toIsoLocal(dt: string) {
    const d = new Date(dt);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
  }

  function normalizeImageList(arr: any): string[] {
    if (!arr) return [];
    if (Array.isArray(arr)) return arr.map(String);
    return [String(arr)];
  }

  function isStoragePath(s: string) {
    return !/^https?:\/\//i.test(s);
  }

  function publicUrlForPath(path: string) {
    return supabase.storage.from('post-media').getPublicUrl(path).data.publicUrl;
  }

  // --- load
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setMsg('');
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id ?? null;
        if (!cancelled) setMeId(uid);

        const { data: gRow, error: gErr } = await supabase
          .from('groups')
          .select('id,slug,name,about,city,country,status,created_by,created_at')
          .eq('slug', slug)
          .maybeSingle();
        if (gErr) throw gErr;
        if (!gRow || (gRow.status !== 'active' && uid !== gRow.created_by)) {
          notFound();
          return;
        }
        if (!cancelled) {
          setGroup(gRow as Group);
          setAboutDraft((gRow as Group).about ?? '');
        }

        // members
        const { data: gm } = await supabase
          .from('group_members')
          .select('profile_id,role')
          .eq('group_id', gRow.id);

        const ids = (gm || []).map((r: any) => r.profile_id);
        const { data: profs } = ids.length
          ? await supabase.from('profiles').select('id,display_name').in('id', ids)
          : { data: [] as any[] };

        const nameMap = new Map<string, string | null>();
        for (const p of (profs || []) as any[]) nameMap.set(p.id, p.display_name ?? null);

        const mList: Member[] = (gm || []).map((r: any) => ({
          profile_id: r.profile_id,
          role: r.role,
          display_name: nameMap.get(r.profile_id) ?? null,
        }));
        mList.sort((a, b) => (a.role === 'anchor' && b.role !== 'anchor' ? -1 : 1));

        if (!cancelled) {
          setMembers(mList);
          const mine = uid ? mList.find((m) => m.profile_id === uid) : undefined;
          setIsMember(!!mine);
          setIsAnchor(mine?.role === 'anchor');
        }

        // events
        const { data: eRows } = await supabase
          .from('group_events')
          .select('id,title,description,starts_at,ends_at,location,is_online')
          .eq('group_id', gRow.id)
          .gte('starts_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
          .order('starts_at', { ascending: true })
          .limit(10);

        let eList: EventRow[] = (eRows || []) as any[];
        if (eList.length) {
          const eids = eList.map((e) => e.id);
          const [cRes, mRes] = await Promise.all([
            supabase.from('event_rsvps').select('event_id').in('event_id', eids),
            uid
              ? supabase.from('event_rsvps').select('event_id').in('event_id', eids).eq('profile_id', uid)
              : Promise.resolve({ data: [] as any[] }),
          ]);
          const counts = new Map<string, number>();
          for (const r of ((cRes.data || []) as any[])) {
            counts.set(r.event_id, (counts.get(r.event_id) || 0) + 1);
          }
          const mineSet = new Set<string>(((mRes as any).data || []).map((r: any) => r.event_id));
          eList = eList.map((e) => ({
            ...e,
            rsvp_count: counts.get(e.id) || 0,
            i_rsvped: mineSet.has(e.id),
          }));
        }
        if (!cancelled) setEvents(eList);

        // posts (exact columns)
        const { data: pRows } = await supabase
          .from('posts')
          .select('id, created_at, profile_id, body, images, group_id')
          .eq('group_id', gRow.id)
          .order('created_at', { ascending: false })
          .limit(20);

        let pList: PostPreview[] =
          (pRows || []).map((p: any) => {
            const imgs = normalizeImageList(p.images).map((u) => (isStoragePath(u) ? publicUrlForPath(u) : u));
            return {
              id: p.id,
              created_at: p.created_at,
              author_id: p.profile_id,
              body: p.body ?? null,
              image_urls: imgs,
            };
          }) ?? [];

        if (pList.length) {
          const authorIds = Array.from(new Set(pList.map((p) => p.author_id)));
          const { data: profs2 } = await supabase
            .from('profiles')
            .select('id,display_name')
            .in('id', authorIds);
          const map2 = new Map<string, string | null>();
          for (const p of (profs2 || []) as any[]) map2.set(p.id, p.display_name ?? null);
          pList = pList.map((p) => ({ ...p, author_name: map2.get(p.author_id) ?? null }));
        }
        if (!cancelled) setPosts(pList);

        // offers (same as before)
        const { data: oRows } = await supabase
          .from('offers')
          .select('id,title,status,created_at,owner_id')
          .eq('group_id', gRow.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(10);

        let oList: OfferPreview[] = (oRows || []) as any[];
        if (oList.length) {
          const ids2 = Array.from(new Set(oList.map((o) => o.owner_id)));
          const { data: profs3 } = await supabase
            .from('profiles')
            .select('id,display_name')
            .in('id', ids2);
          const map3 = new Map<string, string | null>();
          for (const p of (profs3 || []) as any[]) map3.set(p.id, p.display_name ?? null);
          oList = oList.map((o) => ({ ...o, owner_name: map3.get(o.owner_id) ?? null }));
        }
        if (!cancelled) setOffers(oList);
      } catch (e: any) {
        console.error(e);
        if (!cancelled) setMsg(e?.message ?? 'Failed to load chapter.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      // revoke previews on unmount
      previewUrls.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const anchors = useMemo(() => members.filter((m) => m.role === 'anchor'), [members]);
  const filteredOffers = useMemo(() => {
    const q = offerQ.trim().toLowerCase();
    if (!q) return offers;
    return offers.filter((o) => o.title.toLowerCase().includes(q));
  }, [offers, offerQ]);

  // membership
  async function joinChapter() {
    if (!group) return;
    setMsg('');
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push('/signin?next=' + encodeURIComponent(`/chapters/${group.slug}`));
        return;
      }
      const { error } = await supabase
        .from('group_members')
        .insert({ group_id: group.id, profile_id: auth.user.id, role: 'member' });
      if (error) throw error;
      setIsMember(true);
      setMembers((prev) => [...prev, { profile_id: auth.user.id, role: 'member', display_name: auth.user.user_metadata?.display_name ?? null }]);
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? 'Failed to join chapter.');
    }
  }

  async function leaveChapter() {
    if (!group || !meId) return;
    setMsg('');
    if (!confirm('Leave this chapter?')) return;
    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', group.id)
        .eq('profile_id', meId);
      if (error) throw error;
      setIsMember(false);
      setIsAnchor(false);
      setMembers((prev) => prev.filter((m) => m.profile_id !== meId));
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? 'Failed to leave chapter.');
    }
  }

  // RSVP
  async function toggleRsvp(eventId: string, current: boolean | undefined) {
    if (!group) return;
    setMsg('');
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push('/signin?next=' + encodeURIComponent(`/chapters/${group.slug}`));
        return;
      }
      if (!current) {
        const { error } = await supabase
          .from('event_rsvps')
          .insert({ event_id: eventId, profile_id: auth.user.id });
        if (error) throw error;
        setEvents((prev) =>
          prev.map((e) =>
            e.id === eventId ? { ...e, i_rsvped: true, rsvp_count: (e.rsvp_count || 0) + 1 } : e
          )
        );
      } else {
        const { error } = await supabase
          .from('event_rsvps')
          .delete()
          .eq('event_id', eventId)
          .eq('profile_id', auth.user.id);
        if (error) throw error;
        setEvents((prev) =>
          prev.map((e) =>
            e.id === eventId ? { ...e, i_rsvped: false, rsvp_count: Math.max((e.rsvp_count || 1) - 1, 0) } : e
          )
        );
      }
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? 'Failed to update RSVP.');
    }
  }

  // About
  async function saveAbout() {
    if (!group) return;
    setMsg('');
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push('/signin');
        return;
      }
      const about = aboutDraft.trim() || null;
      const { error } = await supabase.from('groups').update({ about }).eq('id', group.id);
      if (error) throw error;
      setGroup((g) => (g ? { ...g, about } : g));
      setEditingAbout(false);
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? 'Failed to save About.');
    }
  }

  // image previews
  function refreshPreviews(files: File[]) {
    previewUrls.forEach((u) => URL.revokeObjectURL(u));
    setPreviewUrls(files.map((f) => URL.createObjectURL(f)));
  }
  function removeImageAt(i: number) {
    const next = postFiles.slice();
    next.splice(i, 1);
    setPostFiles(next);
    refreshPreviews(next);
  }
  function clearAllImages() {
    setPostFiles([]);
    refreshPreviews([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // upload like PostComposer (returns PUBLIC URL)
  async function uploadToPostMedia(file: File): Promise<string> {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) throw new Error('Not signed in');
    const key = `${uid}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from('post-media').upload(key, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type || 'image/*',
    });
    if (error) throw error;
    return supabase.storage.from('post-media').getPublicUrl(key).data.publicUrl;
  }

  // create post (uses profile_id, body, images[], group_id)
  async function createPost() {
    if (!group) return;
    setMsg('');
    setPosting(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push('/signin?next=' + encodeURIComponent(`/chapters/${group.slug}`));
        return;
      }

      const text = postText.trim();
      if (!text && postFiles.length === 0) {
        setMsg('Share a message or add at least one image.');
        setPosting(false);
        return;
      }

      // upload files -> public URLs (like global composer)
      const urls: string[] = [];
      for (const f of postFiles) urls.push(await uploadToPostMedia(f));

      const payload = {
        profile_id: auth.user.id,
        body: text || null,
        images: urls.length ? urls : [],     // images is NOT NULL (text[]), so use [] when none
        group_id: group.id,
      };

      const { data, error } = await supabase
        .from('posts')
        .insert(payload)
        .select('id, created_at, profile_id, body, images, group_id')
        .single();
      if (error) throw error;

      // lookup name for immediate UI
      const { data: prof } = await supabase
        .from('profiles')
        .select('id,display_name')
        .eq('id', data.profile_id)
        .maybeSingle();

      const newPost: PostPreview = {
        id: data.id,
        created_at: data.created_at,
        author_id: data.profile_id,
        author_name: (prof as any)?.display_name ?? data.profile_id.slice(0, 8),
        body: data.body ?? null,
        image_urls: normalizeImageList(data.images).map((u) => (isStoragePath(u) ? publicUrlForPath(u) : u)),
      };

      setPosts((prev) => [newPost, ...prev]);
      setPostText('');
      clearAllImages();
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? 'Could not post.');
    } finally {
      setPosting(false);
    }
  }

  // --- render
  if (loading) return <div className="max-w-5xl p-4 text-sm text-gray-600">Loading chapter…</div>;
  if (!group) {
    return (
      <div className="max-w-5xl p-4">
        <h1 className="text-xl font-semibold">Chapter not found</h1>
        <p className="mt-2 text-gray-600">The chapter you’re looking for doesn’t exist or isn’t public.</p>
        <Link href="/chapters" className="mt-4 inline-block hx-btn hx-btn--outline-primary">Back to Chapters</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      {/* Header */}
      <section className="hx-card p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">{group.name}</h1>
            <div className="mt-1 text-sm text-gray-600">
              {group.city || group.country ? (<>{group.city}{group.city && group.country ? ', ' : ''}{group.country}</>) : 'Location: —'}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isMember ? (
              <>
                <span className="rounded-full border px-3 py-1 text-sm">Member</span>
                {isAnchor && <span className="rounded-full border px-3 py-1 text-sm">Anchor</span>}
                <button onClick={leaveChapter} className="hx-btn hx-btn--outline-primary">Leave</button>
              </>
            ) : (
              <button onClick={joinChapter} className="hx-btn hx-btn--primary">Join</button>
            )}
          </div>
        </div>

        {/* About (editable for anchors) */}
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">About this chapter</h3>
            {isAnchor && !editingAbout && (
              <button onClick={() => setEditingAbout(true)} className="hx-btn hx-btn--outline-primary text-xs px-2 py-1">
                Edit About
              </button>
            )}
          </div>
          {!editingAbout ? (
            group.about ? <p className="max-w-prose whitespace-pre-wrap text-gray-800">{group.about}</p>
                        : <p className="text-sm text-gray-600">No description yet.</p>
          ) : (
            <div className="rounded border p-3">
              <textarea
                className="w-full rounded border px-3 py-2 min-h-[160px]"
                value={aboutDraft}
                onChange={(e) => setAboutDraft(e.target.value)}
                placeholder="Write a short, welcoming description."
              />
              <div className="mt-2 flex gap-2">
                <button onClick={saveAbout} className="hx-btn hx-btn--primary">Save</button>
                <button onClick={() => { setEditingAbout(false); setAboutDraft(group.about ?? ''); }} className="hx-btn hx-btn--secondary">Cancel</button>
              </div>
            </div>
          )}
        </div>

        {/* Anchors */}
        {members.some((m) => m.role === 'anchor') && (
          <div className="mt-6">
            <h3 className="mb-2 text-sm font-semibold text-gray-700">Anchors</h3>
            <div className="flex flex-wrap gap-2">
              {members.filter((m) => m.role === 'anchor').map((a) => (
                <span key={a.profile_id} className="rounded-full border px-3 py-1 text-sm">
                  {a.display_name || a.profile_id.slice(0, 8)}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Events */}
      <section className="hx-card p-4 sm:p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Upcoming events</h2>
          {isAnchor && (
            <button onClick={() => setShowEventForm((s) => !s)} className="hx-btn hx-btn--outline-primary">
              {showEventForm ? 'Close' : 'Create event'}
            </button>
          )}
        </div>

        {isAnchor && showEventForm && (
          <div className="mb-4 rounded border p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium">Title</label>
                <input className="mt-1 w-full rounded border px-3 py-2" value={evTitle} onChange={(e)=>setEvTitle(e.target.value)} placeholder="Share Circle — May"/>
              </div>
              <div>
                <label className="block text-sm font-medium">Starts</label>
                <input type="datetime-local" className="mt-1 w-full rounded border px-3 py-2" value={evStart} onChange={(e)=>setEvStart(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium">Ends (optional)</label>
                <input type="datetime-local" className="mt-1 w-full rounded border px-3 py-2" value={evEnd} onChange={(e)=>setEvEnd(e.target.value)} />
              </div>
              <div className="sm:col-span-2 flex items-center gap-3">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={evOnline} onChange={(e)=>setEvOnline(e.target.checked)} />
                  Online event
                </label>
                {!evOnline && (
                  <>
                    <label className="text-sm">Location</label>
                    <input className="rounded border px-2 py-1 text-sm flex-1" value={evLocation} onChange={(e)=>setEvLocation(e.target.value)} placeholder="Community Hall, 123 Main…" />
                  </>
                )}
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium">Description (optional)</label>
                <textarea className="mt-1 w-full rounded border px-3 py-2 min-h-[100px]" value={evDesc} onChange={(e)=>setEvDesc(e.target.value)} placeholder="What to expect, what to bring…" />
              </div>
            </div>
            <div className="mt-3">
              <button disabled={creatingEvent} onClick={createEvent} className="hx-btn hx-btn--primary">
                {creatingEvent ? 'Creating…' : 'Create event'}
              </button>
            </div>
          </div>
        )}

        {events.length === 0 ? (
          <p className="text-sm text-gray-600">No upcoming events yet.</p>
        ) : (
          <ul className="space-y-3">
            {events.map((e) => (
              <li key={e.id} className="rounded border p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="font-medium">{e.title}</div>
                    <div className="text-sm text-gray-600">
                      {new Date(e.starts_at).toLocaleString()}
                      {e.ends_at ? <> – {new Date(e.ends_at).toLocaleString()}</> : null}
                    </div>
                    <div className="text-sm text-gray-600">
                      {e.is_online ? 'Online' : e.location || 'Location TBA'}
                    </div>
                    {e.description && <p className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">{e.description}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">{e.rsvp_count ?? 0} going</span>
                    <button onClick={() => toggleRsvp(e.id, e.i_rsvped)} className={e.i_rsvped ? 'hx-btn hx-btn--secondary' : 'hx-btn hx-btn--primary'}>
                      {e.i_rsvped ? 'Cancel RSVP' : 'RSVP'}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Posts */}
      <section className="hx-card p-4 sm:p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent posts</h2>
          {!isMember && <span className="text-xs text-gray-600">Join to post</span>}
        </div>

        {isMember && (
          <div className="mb-4 rounded border p-3">
            <label className="block text-sm font-medium">Share something with this chapter</label>
            <textarea
              className="mt-1 w-full rounded border px-3 py-2 min-h-[90px]"
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
              placeholder="What would you like to offer or reflect on?"
            />

            {/* Images */}
            <div className="mt-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium">Add images (optional, up to 6)</label>
                {postFiles.length > 0 && (
                  <button type="button" className="text-xs underline" onClick={clearAllImages}>
                    Clear all
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="mt-1"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []).slice(0, 6);
                  setPostFiles(files);
                  refreshPreviews(files);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              />
              {previewUrls.length > 0 && (
                <div className="mt-2 grid grid-cols-6 gap-2">
                  {previewUrls.map((url, i) => (
                    <div key={i} className="relative rounded border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-16 w-full rounded object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImageAt(i)}
                        className="absolute right-1 top-1 rounded-full bg-white/90 px-2 text-xs shadow"
                        aria-label="Remove image"
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-3">
              <button onClick={createPost} disabled={posting} className="hx-btn hx-btn--primary">
                {posting ? 'Posting…' : 'Post'}
              </button>
            </div>
          </div>
        )}

        {posts.length === 0 ? (
          <p className="text-sm text-gray-600">No posts yet.</p>
        ) : (
          <ul className="space-y-3">
            {posts.map((p) => (
              <li key={p.id} className="rounded border p-3">
                <div className="text-sm text-gray-600">
                  {p.author_name || p.author_id.slice(0, 8)} • {new Date(p.created_at).toLocaleString()}
                </div>
                {p.body && <p className="mt-2 whitespace-pre-wrap">{p.body}</p>}
                {p.image_urls.length > 0 && (
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {p.image_urls.map((url, idx) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={idx} src={url} alt="" className="aspect-square w-full rounded object-cover" />
                    ))}
                  </div>
                )}
                <div className="mt-3">
                  <Link href={`/post/${p.id}`} className="hx-btn hx-btn--outline-primary">Open thread</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Offers */}
      <section className="hx-card p-4 sm:p-6">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">Chapter offerings</h2>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Filter</label>
            <input
              value={offerQ}
              onChange={(e) => setOfferQ(e.target.value)}
              className="rounded border px-2 py-1 text-sm"
              placeholder="Search titles…"
            />
          </div>
        </div>

        {filteredOffers.length === 0 ? (
          <p className="text-sm text-gray-600">No active offerings yet.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {filteredOffers.map((o) => (
              <li key={o.id} className="rounded border p-3">
                <div className="font-medium">{o.title}</div>
                <div className="mt-1 text-sm text-gray-600">
                  by {o.owner_name || o.owner_id.slice(0, 8)} • {new Date(o.created_at).toLocaleDateString()}
                </div>
                <div className="mt-3">
                  <Link href={`/offers/${o.id}`} className="hx-btn hx-btn--primary">Ask to Receive</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {msg && <p className="text-sm text-amber-700">{msg}</p>}
    </div>
  );
}
