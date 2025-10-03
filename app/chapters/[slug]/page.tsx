'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import PostItem from '@/components/PostItem';
import CityOffersRail, { CityOffer } from '@/components/CityOffersRail';

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

type Member = { profile_id: string; role: 'anchor' | 'member'; display_name: string | null };

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

type OfferPreview = {
  id: string;
  title: string;
  status: 'pending' | 'active' | 'paused' | 'archived' | 'blocked';
  created_at: string;
  owner_id: string;
  owner_name?: string | null;
  images?: string[] | null;
  thumb?: string | null;
};

type FeedPost = {
  id: string;
  profile_id: string;
  body: string | null;
  created_at: string;
  images?: string[] | null;
  profiles?: { display_name: string | null } | null;
};

export default function ChapterPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();

  const [meId, setMeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [isAnchor, setIsAnchor] = useState(false);

  const [events, setEvents] = useState<EventRow[]>([]);
  const [offers, setOffers] = useState<OfferPreview[]>([]);
  const [offerQ, setOfferQ] = useState('');

  // Auto-populated carousel under About (local + online)
  const [cityOffers, setCityOffers] = useState<CityOffer[] | null>(null);

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [postText, setPostText] = useState('');
  const [postFiles, setPostFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingAbout, setEditingAbout] = useState(false);
  const [aboutDraft, setAboutDraft] = useState('');

  const [showEventForm, setShowEventForm] = useState(false);
  const [evTitle, setEvTitle] = useState('');
  const [evDesc, setEvDesc] = useState('');
  const [evStart, setEvStart] = useState('');
  const [evEnd, setEvEnd] = useState('');
  const [evOnline, setEvOnline] = useState(false);
  const [evLocation, setEvLocation] = useState('');
  const [creatingEvent, setCreatingEvent] = useState(false);

  const offerTrackRef = useRef<HTMLDivElement | null>(null);

  function toIsoLocal(dt: string) {
    const d = new Date(dt);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
  }
  function normalizeProfile<T extends { profiles?: any }>(row: T) {
    const p = (row as any).profiles;
    return { ...row, profiles: Array.isArray(p) ? (p?.[0] ?? null) : p ?? null };
  }
  function isStoragePath(s: string) {
    return !!s && !/^https?:\/\//i.test(s);
  }
  function publicUrlForPath(path: string) {
    return supabase.storage.from('post-media').getPublicUrl(path).data.publicUrl;
  }
  function normalizeImageList(arr: any): string[] {
    if (!arr) return [];
    if (Array.isArray(arr)) return arr.map(String);
    return [String(arr)];
  }
  function offerThumb(o: { images?: string[] | null }): string | null {
    const candidate = Array.isArray(o.images) && o.images.length > 0 ? o.images[0] : null;
    if (!candidate) return null;
    return isStoragePath(candidate) ? publicUrlForPath(String(candidate)) : String(candidate);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setMsg('');
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id ?? null;
        if (!cancelled) setMeId(uid);

        // 1) Load group
        const { data: gRow, error: gErr } = await supabase
          .from('groups')
          .select('id,slug,name,about,city,country,status,created_by,created_at')
          .eq('slug', slug)
          .maybeSingle();
        if (gErr) throw gErr;
        if (!gRow) {
          setMsg('Chapter not found.');
          setLoading(false);
          return;
        }
        if (!cancelled) {
          setGroup(gRow as Group);
          setAboutDraft((gRow as Group).about ?? '');
        }

        // 2) Members
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
          setIsAnchor(mine?.role === 'anchor' || uid === gRow.created_by);
        }

        // 3) Events
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
              ? supabase
                  .from('event_rsvps')
                  .select('event_id')
                  .in('event_id', eids)
                  .eq('profile_id', uid)
              : Promise.resolve({ data: [] as any[] }),
          ]);
          const counts = new Map<string, number>();
          for (const r of ((cRes.data || []) as any[])) counts.set(r.event_id, (counts.get(r.event_id) || 0) + 1);
          const mineSet = new Set<string>(((mRes as any).data || []).map((r: any) => r.event_id));
          eList = eList.map((e) => ({ ...e, rsvp_count: counts.get(e.id) || 0, i_rsvped: mineSet.has(e.id) }));
        }
        if (!cancelled) setEvents(eList);

        // 4) Posts (chapter feed)
        const { data: pRows, error: pErr } = await supabase
          .from('posts')
          .select('id,profile_id,body,created_at,images,group_id,profiles(display_name)')
          .eq('group_id', gRow.id)
          .order('created_at', { ascending: false })
          .limit(50);
        if (pErr) throw pErr;
        const pList: FeedPost[] = (pRows || []).map((row: any) =>
          normalizeProfile({
            ...row,
            images: normalizeImageList(row.images).map((u: string) =>
              isStoragePath(u) ? publicUrlForPath(u) : u
            ),
          })
        );
        if (!cancelled) setPosts(pList);

        // 5) Offers explicitly attached to this group (kept list below)
        const { data: oRows } = await supabase
          .from('offers')
          .select('id,title,status,created_at,owner_id,images')
          .eq('group_id', gRow.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(20);
        let oList: OfferPreview[] = (oRows || []) as any[];
        if (oList.length) {
          const ids2 = Array.from(new Set(oList.map((o) => o.owner_id)));
          const { data: profs3 } = await supabase
            .from('profiles')
            .select('id,display_name')
            .in('id', ids2);
          const map3 = new Map<string, string | null>();
          for (const p of (profs3 || []) as any[]) map3.set(p.id, p.display_name ?? null);
          oList = oList.map((o) => ({
            ...o,
            owner_name: map3.get(o.owner_id) ?? null,
            thumb: offerThumb(o),
          }));
        }
        if (!cancelled) setOffers(oList);

        // 6) Local (city+country) OR Online offers for the carousel
        {
          const hasCity = (gRow.city || '').trim().length > 0;
          const hasCountry = (gRow.country || '').trim().length > 0;

          let localRows: any[] = [];
          if (hasCity && hasCountry) {
            const { data, error } = await supabase
              .from('offers')
              .select('id,title,images,owner_id,created_at,city,country,status,online')
              .eq('status', 'active')
              .ilike('city', (gRow.city || '').trim())
              .ilike('country', (gRow.country || '').trim())
              .limit(50);
            if (error) throw error;
            localRows = data || [];
          }

          const { data: onlineRows, error: onErr } = await supabase
            .from('offers')
            .select('id,title,images,owner_id,created_at,city,country,status,online')
            .eq('status', 'active')
            .eq('online', true)
            .limit(50);
          if (onErr) throw onErr;

          const allRows = [...localRows, ...(onlineRows || [])];

          // De-dupe by id, newest first
          const byId = new Map<string, any>();
          for (const row of allRows) {
            const prev = byId.get(row.id);
            if (!prev || +new Date(row.created_at) > +new Date(prev.created_at)) byId.set(row.id, row);
          }
          const merged = Array.from(byId.values())
            .sort((a: any, b: any) => +new Date(b.created_at) - +new Date(a.created_at))
            .slice(0, 24);

          // Owner names
          const ownerIds = Array.from(new Set(merged.map((r: any) => r.owner_id)));
          const { data: owners } =
            ownerIds.length
              ? await supabase.from('profiles').select('id,display_name').in('id', ownerIds)
              : { data: [] as any[] };
          const nameById = new Map<string, string | null>();
          for (const p of (owners || []) as any[]) nameById.set(p.id, p.display_name ?? null);

          const cityList: CityOffer[] = merged.map((row: any) => {
            const first = Array.isArray(row.images) && row.images.length ? row.images[0] : null;
            const thumb_url = first ? (isStoragePath(first) ? publicUrlForPath(first) : String(first)) : null;
            return {
              id: row.id,
              title: row.title ?? 'Untitled offer',
              owner_display_name: nameById.get(row.owner_id) ?? null,
              thumb_url,
            } as CityOffer;
          });

          if (!cancelled) setCityOffers(cityList);
        }
      } catch (e: any) {
        console.error(e);
        if (!cancelled) setMsg(e?.message ?? 'Failed to load chapter.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
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
      setMembers((prev) => [
        ...prev,
        {
          profile_id: auth.user.id,
          role: 'member',
          display_name: auth.user.user_metadata?.display_name ?? null,
        },
      ]);
    } catch (e: any) {
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
      setMsg(e?.message ?? 'Failed to leave chapter.');
    }
  }

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
      setMsg(e?.message ?? 'Failed to save About.');
    }
  }

  function removeImageAt(i: number) {
    const next = postFiles.slice();
    next.splice(i, 1);
    setPostFiles(next);
    setPreviewUrls(next.map((f) => URL.createObjectURL(f)));
  }
  function clearAllImages() {
    setPostFiles([]);
    setPreviewUrls([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }
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
      const urls: string[] = [];
      for (const f of postFiles) urls.push(await uploadToPostMedia(f));

      const { data: inserted, error: insErr } = await supabase
        .from('posts')
        .insert({ profile_id: auth.user.id, body: text || null, images: urls, group_id: group.id })
        .select('id')
        .single();
      if (insErr) throw insErr;

      const { data: full } = await supabase
        .from('posts')
        .select('id,profile_id,body,created_at,images,group_id,profiles(display_name)')
        .eq('id', inserted!.id)
        .maybeSingle();

      if (full) {
        const normalized = normalizeProfile({
          ...full,
          images: normalizeImageList(full.images).map((u: string) => (isStoragePath(u) ? publicUrlForPath(u) : u)),
        }) as FeedPost;
        setPosts((prev) => [normalized, ...prev]);
      }

      setPostText('');
      clearAllImages();
    } catch (e: any) {
      setMsg(e?.message ?? 'Could not post.');
    } finally {
      setPosting(false);
    }
  }

  async function createEvent() {
    if (!group) return;
    setMsg('');
    setCreatingEvent(true);
    try {
      if (!evTitle.trim() || !evStart) {
        setMsg('Title and start time are required.');
        setCreatingEvent(false);
        return;
      }
      const starts_at = toIsoLocal(evStart);
      const ends_at = evEnd ? toIsoLocal(evEnd) : null;
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push('/signin?next=' + encodeURIComponent(`/chapters/${group.slug}`));
        return;
      }
      const { data, error } = await supabase
        .from('group_events')
        .insert({
          group_id: group.id,
          title: evTitle.trim(),
          description: evDesc.trim() || null,
          starts_at,
          ends_at,
          is_online: evOnline,
          location: evOnline ? null : (evLocation.trim() || null),
        })
        .select('id,title,description,starts_at,ends_at,location,is_online')
        .single();
      if (error) throw error;
      setEvents((prev) =>
        [...prev, { ...data!, rsvp_count: 0, i_rsvped: false }].sort(
          (a, b) => +new Date(a.starts_at) - +new Date(b.starts_at)
        )
      );
      setEvTitle('');
      setEvDesc('');
      setEvStart('');
      setEvEnd('');
      setEvOnline(false);
      setEvLocation('');
      setShowEventForm(false);
    } catch (e: any) {
      setMsg(e?.message ?? 'Failed to create event.');
    } finally {
      setCreatingEvent(false);
    }
  }

  if (loading) return <div className="max-w-5xl p-4 text-sm text-gray-600">Loading chapter…</div>;
  if (!group) {
    return (
      <div className="max-w-5xl p-4">
        <h1 className="text-xl font-semibold">Chapter not found</h1>
        <p className="mt-2 text-gray-600">The chapter you’re looking for doesn’t exist or isn’t public.</p>
        <Link href="/chapters" className="mt-4 inline-block hx-btn hx-btn--outline-primary">
          Back to Chapters
        </Link>
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
              {group.city || group.country ? (
                <>
                  {group.city}
                  {group.city && group.country ? ', ' : ''}
                  {group.country}
                </>
              ) : (
                'Location: —'
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isMember ? (
              <>
                <span className="rounded-full border px-3 py-1 text-sm">Member</span>
                {isAnchor && <span className="rounded-full border px-3 py-1 text-sm">Anchor</span>}
                <button onClick={leaveChapter} className="hx-btn hx-btn--outline-primary">
                  Leave
                </button>
              </>
            ) : (
              <button onClick={joinChapter} className="hx-btn hx-btn--primary">
                Join
              </button>
            )}
          </div>
        </div>

        {/* About */}
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">About this chapter</h3>
            {isAnchor && !editingAbout && (
              <button
                onClick={() => setEditingAbout(true)}
                className="hx-btn hx-btn--outline-primary text-xs px-2 py-1"
              >
                Edit About
              </button>
            )}
          </div>
          {!editingAbout ? (
            group.about ? (
              <p className="max-w-prose whitespace-pre-wrap text-gray-800">{group.about}</p>
            ) : (
              <p className="text-sm text-gray-600">No description yet.</p>
            )
          ) : (
            <div className="rounded border p-3">
              <textarea
                className="w-full rounded border px-3 py-2 min-h-[160px]"
                value={aboutDraft}
                onChange={(e) => setAboutDraft(e.target.value)}
                placeholder="Write a short, welcoming description."
              />
              <div className="mt-2 flex gap-2">
                <button onClick={saveAbout} className="hx-btn hx-btn--primary">
                  Save
                </button>
                <button
                  onClick={() => {
                    setEditingAbout(false);
                    setAboutDraft(group.about ?? '');
                  }}
                  className="hx-btn hx-btn--secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Auto-populated carousel (Local + Online) */}
        {cityOffers && cityOffers.length > 0 && (
          <CityOffersRail
            offers={cityOffers}
            title={`Local & online offerings${group.city ? ` in ${group.city}` : ''}`}
            seeAllHref={`/browse?city=${encodeURIComponent(group.city || '')}&country=${encodeURIComponent(
              group.country || ''
            )}&online=true`}
          />
        )}

        {/* Anchors */}
        {anchors.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-2 text-sm font-semibold text-gray-700">Anchors</h3>
            <div className="flex flex-wrap gap-2">
              {anchors.map((a) => (
                <span key={a.profile_id} className="rounded-full border px-3 py-1 text-sm">
                  {a.display_name || a.profile_id.slice(0, 8)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Existing scroller for offers explicitly shared to this chapter */}
        {offers.length > 0 && (
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Offers shared in this chapter</h3>
              <div className="flex items-center gap-2">
                <button
                  aria-label="Scroll left"
                  className="rounded border px-2 py-1 text-sm"
                  onClick={() => {
                    const el = offerTrackRef.current;
                    if (el) el.scrollBy({ left: -320, behavior: 'smooth' });
                  }}
                >
                  ‹
                </button>
                <button
                  aria-label="Scroll right"
                  className="rounded border px-2 py-1 text-sm"
                  onClick={() => {
                    const el = offerTrackRef.current;
                    if (el) el.scrollBy({ left: 320, behavior: 'smooth' });
                  }}
                >
                  ›
                </button>
              </div>
            </div>
            <div ref={offerTrackRef} className="flex gap-3 overflow-x-auto" style={{ scrollSnapType: 'x mandatory' }}>
              {offers.map((o) => (
                <Link
                  key={o.id}
                  href={`/offers/${o.id}`}
                  className="min-w-[280px] max-w-[280px] rounded border p-3 hover:shadow"
                  style={{ scrollSnapAlign: 'start' }}
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-16 max-w-16 h-16 rounded overflow-hidden border">
                      {o.thumb ? (
                        <img src={o.thumb} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-gray-500 bg-gray-50">
                          No image
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="line-clamp-2 font-medium leading-snug">{o.title}</div>
                      <div className="mt-1 text-xs text-gray-600">
                        by {o.owner_name || o.owner_id.slice(0, 8)} • {new Date(o.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </Link>
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
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={evTitle}
                  onChange={(e) => setEvTitle(e.target.value)}
                  placeholder="Share Circle — May"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Starts</label>
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={evStart}
                  onChange={(e) => setEvStart(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Ends (optional)</label>
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={evEnd}
                  onChange={(e) => setEvEnd(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2 flex items-center gap-3">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={evOnline} onChange={(e) => setEvOnline(e.target.checked)} />
                  Online event
                </label>
                {!evOnline && (
                  <>
                    <label className="text-sm">Location</label>
                    <input
                      className="rounded border px-2 py-1 text-sm flex-1"
                      value={evLocation}
                      onChange={(e) => setEvLocation(e.target.value)}
                      placeholder="Community Hall, 123 Main…"
                    />
                  </>
                )}
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium">Description (optional)</label>
                <textarea
                  className="mt-1 w-full rounded border px-3 py-2 min-h-[100px]"
                  value={evDesc}
                  onChange={(e) => setEvDesc(e.target.value)}
                  placeholder="What to expect, what to bring…"
                />
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
                    <div className="text-sm text-gray-600">{e.is_online ? 'Online' : e.location || 'Location TBA'}</div>
                    {e.description && <p className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">{e.description}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">{e.rsvp_count ?? 0} going</span>
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
                  setPreviewUrls(files.map((f) => URL.createObjectURL(f)));
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              />
              {previewUrls.length > 0 && (
                <div className="mt-2 grid grid-cols-6 gap-2">
                  {previewUrls.map((url, i) => (
                    <div key={i} className="relative rounded border">
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

        <div className="space-y-3">
          {posts.length === 0 ? (
            <p className="text-sm text-gray-600">No posts yet.</p>
          ) : (
            posts.map((p) => (
              <PostItem
                key={p.id}
                post={{ ...p, body: p.body ?? '', images: p.images ?? [] }}
                me={meId}
                onDeleted={() => setPosts((prev) => prev.filter((x) => x.id !== p.id))}
              />
            ))
          )}
        </div>
      </section>

      {/* Offers list with right-side thumbnails */}
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
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="font-medium">{o.title}</div>
                    <div className="mt-1 text-sm text-gray-600">
                      by {o.owner_name || o.owner_id.slice(0, 8)} • {new Date(o.created_at).toLocaleDateString()}
                    </div>
                    <div className="mt-3">
                      <Link href={`/offers/${o.id}`} className="hx-btn hx-btn--primary">
                        Ask to Receive
                      </Link>
                    </div>
                  </div>
                  <div className="ml-2 h-16 w-24 shrink-0 overflow-hidden rounded border">
                    {o.thumb ? (
                      <img src={o.thumb} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-gray-500 bg-gray-50">
                        No image
                      </div>
                    )}
                  </div>
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
