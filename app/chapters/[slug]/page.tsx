// /app/chapters/[slug]/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import PostItem from '@/components/PostItem';
import CityOffersRail, { CityOffer } from '@/components/CityOffersRail';
import { uploadEventCoverImage } from '@/lib/storage';

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

// Extended with owner + cover for editing & display
type EventRow = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  is_online: boolean | null;
  cover_url?: string | null;
  created_by?: string | null;
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

// RSVP types
type RSVPStatus = 'going' | 'interested' | 'cant_go';
type RSVPRow = { event_id: string; profile_id: string; status: RSVPStatus };
type ProfileMini = { id: string; display_name: string | null; avatar_url: string | null };

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
  const [cityOffers, setCityOffers] = useState<CityOffer[] | null>(null);

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [postText, setPostText] = useState('');
  const [postFiles, setPostFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingAbout, setEditingAbout] = useState(false);
  const [aboutDraft, setAboutDraft] = useState('');

  // ====== Events state ======
  const [showEventForm, setShowEventForm] = useState(false);
  const [evTitle, setEvTitle] = useState('');
  const [evDesc, setEvDesc] = useState('');
  const [evStart, setEvStart] = useState('');
  const [evEnd, setEvEnd] = useState('');
  const [evOnline, setEvOnline] = useState(false);
  const [evLocation, setEvLocation] = useState('');
  const [evCoverFile, setEvCoverFile] = useState<File | null>(null);
  const [evCoverPreview, setEvCoverPreview] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const [creatingEvent, setCreatingEvent] = useState(false);

  // inline event details & edit
  const [openEventId, setOpenEventId] = useState<string | null>(null);
  const [editEventId, setEditEventId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    title: string;
    description: string;
    starts_at: string;
    ends_at: string;
    is_online: boolean;
    location: string;
    cover_url: string | null;
    cover_file: File | null;
    cover_preview: string | null;
  } | null>(null);
  const editCoverInputRef = useRef<HTMLInputElement | null>(null);

  // RSVPs: per-event buckets + my selection
  const [rsvpByEvent, setRsvpByEvent] = useState<
    Record<string, { going: ProfileMini[]; interested: ProfileMini[]; cant_go: ProfileMini[] }>
  >({});
  const [myRsvp, setMyRsvp] = useState<Record<string, RSVPStatus | null>>({});

  // Members dialog
  const [membersOpen, setMembersOpen] = useState(false);

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

  const loadAttendeesForEvents = useCallback(async (eventIds: string[]) => {
    if (!eventIds.length) return {};
    const { data: rsvpRows } = await supabase
      .from('event_rsvps')
      .select('event_id,profile_id,status')
      .in('event_id', eventIds);

    // ALWAYS seed requested ids with empty buckets
    const byEvent: Record<
      string,
      { going: ProfileMini[]; interested: ProfileMini[]; cant_go: ProfileMini[] }
    > = {};
    for (const ev of eventIds) {
      byEvent[ev] = { going: [], interested: [], cant_go: [] };
    }

    if (!rsvpRows?.length) return byEvent;

    const pids = Array.from(new Set(rsvpRows.map((r: any) => r.profile_id)));
    const { data: profs } = await supabase
      .from('profiles')
      .select('id,display_name,avatar_url')
      .in('id', pids);

    const pmap = new Map<string, ProfileMini>();
    for (const p of (profs || []) as any[]) {
      pmap.set(p.id, {
        id: p.id,
        display_name: p.display_name ?? null,
        avatar_url: p.avatar_url ?? null,
      });
    }

    for (const r of (rsvpRows as RSVPRow[])) {
      const mini = pmap.get(r.profile_id) || { id: r.profile_id, display_name: null, avatar_url: null };
      byEvent[r.event_id][r.status].push(mini);
    }
    return byEvent;
  }, []);

  async function ensureAttendeesLoaded(eventId: string) {
    if (rsvpByEvent[eventId]) return;
    const map = await loadAttendeesForEvents([eventId]);
    setRsvpByEvent((prev) => ({ ...prev, ...map }));
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
        const { data: gm } = await supabase.from('group_members').select('profile_id,role').eq('group_id', gRow.id);
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
          .select('id,title,description,starts_at,ends_at,location,is_online,cover_url,created_by')
          .eq('group_id', gRow.id)
          .gte('starts_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
          .order('starts_at', { ascending: true })
          .limit(10);

        let eList: EventRow[] = (eRows || []) as any[];
        if (eList.length) {
          const eids = eList.map((e) => e.id);
          // counts + my-rsvp
          const [cRes, mRes] = await Promise.all([
            supabase.from('event_rsvps').select('event_id').in('event_id', eids),
            uid
              ? supabase
                  .from('event_rsvps')
                  .select('event_id,status')
                  .in('event_id', eids)
                  .eq('profile_id', uid)
              : Promise.resolve({ data: [] as any[] }),
          ]);
          const counts = new Map<string, number>();
          for (const r of ((cRes.data || []) as any[])) counts.set(r.event_id, (counts.get(r.event_id) || 0) + 1);

          const myMap: Record<string, RSVPStatus | null> = {};
          for (const r of ((mRes as any).data || []) as { event_id: string; status: RSVPStatus }[]) {
            myMap[r.event_id] = r.status;
          }

          eList = eList.map((e) => ({
            ...e,
            rsvp_count: counts.get(e.id) || 0,
            i_rsvped: Boolean(myMap[e.id]),
          }));
          setMyRsvp(myMap);

          // preload attendees per event for the first few
          const rsvpMap = await loadAttendeesForEvents(eids.slice(0, 5));
          if (!cancelled) setRsvpByEvent((prev) => ({ ...prev, ...rsvpMap }));
        }
        if (!cancelled) setEvents(eList);

        // 4) Posts
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

        // 5) Offers attached to this group (not rendered here)
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
              .select('id,title,images,owner_id,created_at,city,country,status')
              .eq('status', 'active')
              .ilike('city', (gRow.city || '').trim())
              .ilike('country', (gRow.country || '').trim())
              .limit(50);
            if (!error) localRows = data || [];
          }

          // Try 'online', fallback to 'is_online'
          let onlineRows: any[] = [];
          {
            const baseSelect = 'id,title,images,owner_id,created_at,city,country,status';
            const tryOnline = await supabase
              .from('offers')
              .select(baseSelect)
              .eq('status', 'active')
              // @ts-ignore
              .eq('online', true)
              .limit(50);
            if (!tryOnline.error) {
              onlineRows = tryOnline.data || [];
            } else {
              const tryIsOnline = await supabase
                .from('offers')
                .select(baseSelect)
                .eq('status', 'active')
                // @ts-ignore
                .eq('is_online', true)
                .limit(50);
              if (!tryIsOnline.error) onlineRows = tryIsOnline.data || [];
            }
          }

          const allRows = [...localRows, ...onlineRows];

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
            const imgs = Array.isArray(row.images) ? row.images : [];
            const first = imgs.length ? imgs[0] : null;
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

  // Optional realtime: show events created by others immediately
  useEffect(() => {
    if (!group) return;
    const ch = supabase
      .channel('realtime:group_events:ins')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_events', filter: `group_id=eq.${group.id}` },
        (payload) => {
          const row = payload.new as EventRow;
          setEvents((prev) => {
            if (prev.some((e) => e.id === row.id)) return prev;
            const next = [...prev, { ...row, rsvp_count: 0, i_rsvped: false }];
            return next.sort((a, b) => (a.starts_at < b.starts_at ? -1 : 1));
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [group]);

  const anchors = useMemo(() => members.filter((m) => m.role === 'anchor'), [members]);

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

  // ====== Event helpers ======
  function clearEventComposer() {
    setEvTitle('');
    setEvDesc('');
    setEvStart('');
    setEvEnd('');
    setEvOnline(false);
    setEvLocation('');
    setEvCoverFile(null);
    if (evCoverPreview) URL.revokeObjectURL(evCoverPreview);
    setEvCoverPreview(null);
    if (coverInputRef.current) coverInputRef.current.value = '';
  }

  async function createEvent() {
    if (!group) return;
    setMsg('');
    setCreatingEvent(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push('/signin?next=' + encodeURIComponent(`/chapters/${group.slug}`));
        return;
      }
      if (!evTitle.trim() || !evStart) {
        setMsg('Event title and start time are required.');
        setCreatingEvent(false);
        return;
      }

      let cover_url: string | null = null;
      if (evCoverFile) {
        cover_url = await uploadEventCoverImage(auth.user.id, evCoverFile);
      }

      const eventData: any = {
        group_id: group.id,
        title: evTitle.trim(),
        description: evDesc.trim() || null,
        starts_at: toIsoLocal(evStart),
        ends_at: evEnd ? toIsoLocal(evEnd) : null,
        location: evOnline ? null : evLocation.trim() || null,
        is_online: evOnline,
        cover_url,
        created_by: auth.user.id, // ok if column exists; ignored if not
      };

      // Insert and return full row so we can add it immediately
      const { data: inserted, error } = await supabase
        .from('group_events')
        .insert(eventData)
        .select('id,title,description,starts_at,ends_at,location,is_online,cover_url,created_by')
        .single();
      if (error) throw error;

      // Optimistic add (no reload)
      setEvents((prev) => {
        const next = [...prev, { ...inserted, rsvp_count: 0, i_rsvped: false }];
        return next.sort((a, b) => (a.starts_at < b.starts_at ? -1 : 1));
      });

      setShowEventForm(false);
      clearEventComposer();
    } catch (e: any) {
      setMsg(e?.message ?? 'Could not create event.');
    } finally {
      setCreatingEvent(false);
    }
  }

  function canManageEvent(e: EventRow): boolean {
    if (meId && e.created_by && e.created_by === meId) return true;
    return isAnchor;
  }

  async function deleteEvent(id: string) {
    if (!group) return;
    if (!confirm('Delete this event?')) return;
    setMsg('');
    try {
      await supabase.from('group_events').delete().eq('id', id).eq('group_id', group.id);
      setEvents((prev) => prev.filter((x) => x.id !== id));
      // clean RSVP cache
      setRsvpByEvent((prev) => {
        const { [id]: _, ...rest } = prev;
        return rest;
      });
      setMyRsvp((prev) => {
        const { [id]: _, ...rest } = prev;
        return rest;
      });
      if (openEventId === id) setOpenEventId(null);
      if (editEventId === id) setEditEventId(null);
    } catch (e: any) {
      setMsg(e?.message ?? 'Could not delete event.');
    }
  }

  function beginEditEvent(e: EventRow) {
    setEditEventId(e.id);
    setOpenEventId(e.id);
    setEditDraft({
      title: e.title,
      description: e.description || '',
      starts_at: e.starts_at ? new Date(e.starts_at).toISOString().slice(0, 16) : '',
      ends_at: e.ends_at ? new Date(e.ends_at).toISOString().slice(0, 16) : '',
      is_online: !!e.is_online,
      location: e.location || '',
      cover_url: e.cover_url || null,
      cover_file: null,
      cover_preview: null,
    });
  }

  function cancelEditEvent() {
    if (editDraft?.cover_preview) URL.revokeObjectURL(editDraft.cover_preview);
    setEditDraft(null);
    setEditEventId(null);
    if (editCoverInputRef.current) editCoverInputRef.current.value = '';
  }

  async function saveEditEvent(id: string) {
    if (!group || !editDraft) return;
    setMsg('');
    try {
      let cover_url = editDraft.cover_url || null;
      if (editDraft.cover_file) {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) throw new Error('Not signed in');
        cover_url = await uploadEventCoverImage(auth.user.id, editDraft.cover_file);
      }
      const payload: any = {
        title: editDraft.title.trim() || 'Untitled Event',
        description: editDraft.description.trim() || null,
        starts_at: editDraft.starts_at ? toIsoLocal(editDraft.starts_at) : null,
        ends_at: editDraft.ends_at ? toIsoLocal(editDraft.ends_at) : null,
        is_online: editDraft.is_online,
        location: editDraft.is_online ? null : (editDraft.location.trim() || null),
        cover_url,
      };
      await supabase.from('group_events').update(payload).eq('id', id).eq('group_id', group.id);

      setEvents((prev) =>
        prev.map((ev) => (ev.id === id ? { ...ev, ...payload } : ev)),
      );
      cancelEditEvent();
    } catch (e: any) {
      setMsg(e?.message ?? 'Could not save event.');
    }
  }

  async function setRsvp(eventId: string, status: RSVPStatus) {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.push('/signin');
      return;
    }
    try {
      // Upsert via delete+insert to keep it simple
      await supabase.from('event_rsvps').delete().eq('event_id', eventId).eq('profile_id', auth.user.id);
      await supabase.from('event_rsvps').insert({ event_id: eventId, profile_id: auth.user.id, status });

      setMyRsvp((prev) => ({ ...prev, [eventId]: status }));

      // Reload attendees for this event (now safely returns an entry even if empty)
      const map = await loadAttendeesForEvents([eventId]);
      const buckets = map[eventId] ?? { going: [], interested: [], cant_go: [] };
      setRsvpByEvent((prev) => ({ ...prev, [eventId]: buckets }));

      // Update count badge on the tile from buckets (no undefined access)
      const nextCount = buckets.going.length + buckets.interested.length + buckets.cant_go.length;
      setEvents((prev) =>
        prev.map((e) => (e.id === eventId ? { ...e, rsvp_count: nextCount } : e))
      );
    } catch (e: any) {
      setMsg(e?.message ?? 'Could not RSVP.');
    }
  }

  function RsvpList({ eventId }: { eventId: string }) {
    const bucket = rsvpByEvent[eventId] || { going: [], interested: [], cant_go: [] };
    const Section = ({ title, arr }: { title: string; arr: ProfileMini[] }) => (
      <div className="mt-3">
        <div className="text-xs font-semibold text-gray-600">{title} ({arr.length})</div>
        {arr.length === 0 ? (
          <div className="text-xs text-gray-500 mt-1">No one yet.</div>
        ) : (
          <ul className="mt-1 flex flex-wrap gap-3">
            {arr.map((p) => (
              <li key={p.id} className="flex items-center gap-2">
                {p.avatar_url ? (
                  <Image src={p.avatar_url} alt="" width={24} height={24} className="rounded-full object-cover" />
                ) : (
                  <div className="h-6 w-6 rounded-full bg-gray-200" />
                )}
                <Link href={`/u/${p.id}`} className="text-sm underline">
                  {p.display_name || 'Member'}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
    return (
      <div className="mt-3">
        <Section title="Going" arr={bucket.going} />
        <Section title="Interested" arr={bucket.interested} />
        <Section title="Can't go" arr={bucket.cant_go} />
      </div>
    );
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

          {/* Buttons row: Members, Anchor, Join/Leave */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setMembersOpen(true)}
              className="hx-btn hx-btn--primary px-3 py-2"
              title="See all members"
            >
              Members
            </button>

            <Link
              href={`/u/${group.created_by}`}
              className="hx-btn hx-btn--secondary px-3 py-2"
              title="View the anchor's profile"
            >
              Anchor
            </Link>

            {isMember ? (
              <button
                onClick={leaveChapter}
                className="hx-btn hx-btn--outline-primary text-xs px-2 py-1"
                title="Leave this chapter"
              >
                Leave
              </button>
            ) : (
              <button onClick={joinChapter} className="hx-btn hx-btn--primary px-3 py-2">
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

        {/* Soft separation */}
        <div className="mt-4 border-t border-neutral-200" />

        {/* Auto-populated Local & Online */}
        {cityOffers && cityOffers.length > 0 && (
          <CityOffersRail
            offers={cityOffers}
            title={`Local & online offerings${group.city ? ` in ${group.city}` : ''}`}
            seeAllHref={`/browse?city=${encodeURIComponent(group.city || '')}&country=${encodeURIComponent(
              group.country || ''
            )}&online=true`}
          />
        )}
      </section>

      {/* Events */}
      <section className="hx-card p-4 sm:p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Upcoming events</h2>
        </div>

        {/* Create */}
        {isAnchor && (
          <div className="mb-4 space-y-3 rounded border p-3">
            <div className="flex items-center justify-between">
              <button onClick={() => setShowEventForm((s) => !s)} className="hx-btn hx-btn--outline-primary">
                {showEventForm ? 'Close' : 'Create event'}
              </button>
            </div>

            {showEventForm && (
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
                <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
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

                {/* Cover image – real button + hidden input */}
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium">Cover image (optional)</label>
                  <input
                    ref={coverInputRef}
                    className="sr-only"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = (e.target.files && e.target.files[0]) || null;
                      setEvCoverFile(f);
                      if (evCoverPreview) URL.revokeObjectURL(evCoverPreview);
                      setEvCoverPreview(f ? URL.createObjectURL(f) : null);
                    }}
                  />
                  <div className="mt-1 flex items-center gap-3">
                    <button
                      type="button"
                      className="hx-btn hx-btn--secondary"
                      onClick={() => coverInputRef.current?.click()}
                    >
                      Upload image
                    </button>
                    {evCoverPreview && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={evCoverPreview} alt="Cover preview" className="h-16 w-28 rounded object-cover ring-1 ring-gray-200" />
                    )}
                    {evCoverPreview && (
                      <button
                        type="button"
                        className="text-xs underline"
                        onClick={() => {
                          if (evCoverPreview) URL.revokeObjectURL(evCoverPreview);
                          setEvCoverPreview(null);
                          setEvCoverFile(null);
                          if (coverInputRef.current) coverInputRef.current.value = '';
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {showEventForm && (
              <div className="">
                <button disabled={creatingEvent} onClick={createEvent} className="hx-btn hx-btn--primary">
                  {creatingEvent ? 'Creating…' : 'Create event'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* List */}
        {events.length === 0 ? (
          <p className="text-sm text-gray-600">No upcoming events yet.</p>
        ) : (
          <ul className="space-y-3">
            {events.map((e) => {
              const isOpen = openEventId === e.id;
              const canManage = canManageEvent(e);
              const mine = myRsvp[e.id] || null;

              return (
                <li key={e.id} className="rounded border">
                  {/* Clickable header */}
                  <button
                    type="button"
                    onClick={async () => {
                      const nextId = openEventId === e.id ? null : e.id;
                      setOpenEventId(nextId);
                      if (nextId) await ensureAttendeesLoaded(nextId);
                    }}
                    className="w-full text-left p-0 focus:outline-none"
                    aria-expanded={isOpen}
                  >
                    {/* Cover image preview + basic info */}
                    {e.cover_url && (
                      <div className="relative h-40 w-full overflow-hidden rounded-t">
                        <Image
                          src={e.cover_url}
                          alt={e.title}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 100vw, 720px"
                        />
                      </div>
                    )}
                    <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="font-medium">{e.title}</div>
                        <div className="text-sm text-gray-600">
                          {new Date(e.starts_at).toLocaleString()}
                          {e.ends_at ? <> – {new Date(e.ends_at).toLocaleString()}</> : null}
                        </div>
                        <div className="text-sm text-gray-600">
                          {e.is_online ? 'Online' : e.location || 'Location TBA'}
                        </div>
                        {e.description && (
                          <p className="mt-2 line-clamp-2 text-sm text-gray-800">
                            {e.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 pr-2 sm:pr-3">
                        <span className="text-xs text-gray-600">{e.rsvp_count ?? 0} RSVPs</span>
                        <span
                          className={[
                            'ml-auto inline-block rotate-0 transition-transform',
                            isOpen ? 'rotate-180' : 'rotate-0',
                          ].join(' ')}
                          aria-hidden
                        >
                          ▼
                        </span>
                      </div>
                    </div>
                  </button>

                  {/* Expanded details */}
                  {isOpen && (
                    <div className="border-t p-3">
                      {/* Manage buttons (owner/anchor) */}
                      {canManage && editEventId !== e.id && (
                        <div className="mb-2 flex gap-2">
                          <button
                            className="hx-btn hx-btn--outline-primary text-xs px-2 py-1"
                            onClick={() => beginEditEvent(e)}
                          >
                            Edit
                          </button>
                          <button
                            className="hx-btn hx-btn--secondary text-xs px-2 py-1"
                            onClick={() => deleteEvent(e.id)}
                          >
                            Delete
                          </button>
                        </div>
                      )}

                      {/* Edit form */}
                      {editEventId === e.id && editDraft && (
                        <div className="mb-3 rounded border p-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                              <label className="block text-sm font-medium">Title</label>
                              <input
                                className="mt-1 w-full rounded border px-3 py-2"
                                value={editDraft.title}
                                onChange={(ev) =>
                                  setEditDraft((d) => d && { ...d, title: ev.target.value } as any)
                                }
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium">Starts</label>
                              <input
                                type="datetime-local"
                                className="mt-1 w-full rounded border px-3 py-2"
                                value={editDraft.starts_at}
                                onChange={(ev) =>
                                  setEditDraft((d) => d && { ...d, starts_at: ev.target.value } as any)
                                }
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium">Ends (optional)</label>
                              <input
                                type="datetime-local"
                                className="mt-1 w-full rounded border px-3 py-2"
                                value={editDraft.ends_at}
                                onChange={(ev) =>
                                  setEditDraft((d) => d && { ...d, ends_at: ev.target.value } as any)
                                }
                              />
                            </div>
                            <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
                              <label className="inline-flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={editDraft.is_online}
                                  onChange={(ev) =>
                                    setEditDraft((d) => d && { ...d, is_online: ev.target.checked } as any)
                                  }
                                />
                                Online event
                              </label>
                              {!editDraft.is_online && (
                                <>
                                  <label className="text-sm">Location</label>
                                  <input
                                    className="rounded border px-2 py-1 text-sm flex-1"
                                    value={editDraft.location}
                                    onChange={(ev) =>
                                      setEditDraft((d) => d && { ...d, location: ev.target.value } as any)
                                    }
                                  />
                                </>
                              )}
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-sm font-medium">Description</label>
                              <textarea
                                className="mt-1 w-full rounded border px-3 py-2 min-h-[100px]"
                                value={editDraft.description}
                                onChange={(ev) =>
                                  setEditDraft((d) => d && { ...d, description: ev.target.value } as any)
                                }
                              />
                            </div>

                            {/* EDIT: Cover image – real button + hidden input */}
                            <div className="sm:col-span-2">
                              <label className="block text-sm font-medium">Cover image</label>
                              <input
                                ref={editCoverInputRef}
                                className="sr-only"
                                type="file"
                                accept="image/*"
                                onChange={(ev) => {
                                  const f = ev.target.files && ev.target.files[0];
                                  setEditDraft((d) => {
                                    if (!d) return d;
                                    if (d.cover_preview) URL.revokeObjectURL(d.cover_preview);
                                    return {
                                      ...d,
                                      cover_file: f || null,
                                      cover_preview: f ? URL.createObjectURL(f) : null
                                    };
                                  });
                                }}
                              />
                              <div className="mt-1 flex items-center gap-3">
                                <button
                                  type="button"
                                  className="hx-btn hx-btn--secondary"
                                  onClick={() => editCoverInputRef.current?.click()}
                                >
                                  Upload image
                                </button>

                                {(editDraft.cover_preview || editDraft.cover_url) && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={editDraft.cover_preview || (editDraft.cover_url || '')}
                                    alt="Cover preview"
                                    className="h-16 w-28 rounded object-cover ring-1 ring-gray-200"
                                  />
                                )}

                                {editDraft.cover_preview && (
                                  <button
                                    type="button"
                                    className="text-xs underline"
                                    onClick={() => {
                                      setEditDraft((d) => {
                                        if (!d) return d;
                                        if (d.cover_preview) URL.revokeObjectURL(d.cover_preview);
                                        return { ...d, cover_file: null, cover_preview: null };
                                      });
                                      if (editCoverInputRef.current) editCoverInputRef.current.value = '';
                                    }}
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="mt-3 flex gap-2">
                            <button className="hx-btn hx-btn--primary" onClick={() => saveEditEvent(e.id)}>
                              Save
                            </button>
                            <button className="hx-btn hx-btn--secondary" onClick={cancelEditEvent}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {/* RSVP buttons */}
                      <div className="flex flex-wrap gap-2">
                        <button
                          className={[
                            'hx-btn text-sm',
                            mine === 'going' ? 'hx-btn--primary' : 'hx-btn--outline-primary',
                          ].join(' ')}
                          onClick={() => setRsvp(e.id, 'going')}
                        >
                          Going
                        </button>
                        <button
                          className={[
                            'hx-btn text-sm',
                            mine === 'interested' ? 'hx-btn--primary' : 'hx-btn--outline-primary',
                          ].join(' ')}
                          onClick={() => setRsvp(e.id, 'interested')}
                        >
                          Interested
                        </button>
                        <button
                          className={[
                            'hx-btn text-sm',
                            mine === 'cant_go' ? 'hx-btn--primary' : 'hx-btn--outline-primary',
                          ].join(' ')}
                          onClick={() => setRsvp(e.id, 'cant_go')}
                        >
                          Can't go
                        </button>
                      </div>

                      {/* Attendees */}
                      <RsvpList eventId={e.id} />
                    </div>
                  )}
                </li>
              );
            })}
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

      {msg && <p className="text-sm text-amber-700">{msg}</p>}

      {/* Members dialog */}
      {membersOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="text-base font-semibold">Members</h3>
              <button onClick={() => setMembersOpen(false)} className="rounded border px-2 py-1 text-sm hover:bg-gray-50" type="button">
                Close
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-3">
              {members.length === 0 ? (
                <p className="text-sm text-gray-600">No members yet.</p>
              ) : (
                <ul className="space-y-2">
                  {members.map((m) => (
                    <li key={m.profile_id} className="flex items-center justify-between rounded border p-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="truncate font-medium">
                            {m.display_name || 'Unnamed'}
                          </div>
                          <span className="rounded-full border px-2 py-0.5 text-[11px] capitalize text-gray-700">
                            {m.role}
                          </span>
                        </div>
                      </div>
                      <Link
                        href={`/u/${m.profile_id}`}
                        className="hx-btn hx-btn--outline-primary text-xs px-2 py-1 whitespace-nowrap"
                      >
                        View profile
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
