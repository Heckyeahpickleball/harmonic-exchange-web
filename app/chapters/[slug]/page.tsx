/* HX v1.0 — Chapters detail page
   - Public view for active chapters by slug
   - Join/Leave membership for authenticated users
   - Anchors list, About, City/Country
   - Upcoming events (RSVP toggle)
   - Recent posts scoped by group_id (light preview)
   - Chapter-scoped offers (light preview with filter)
   - Uses hx-btn / hx-card styles from globals.css

   Requirements:
   - Tables (as per Phase 1 SQL): groups, group_members, group_events, event_rsvps
   - Extended: posts.group_id, offers.group_id
*/

'use client';

import { useEffect, useMemo, useState } from 'react';
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

type PostPreview = {
  id: string;
  content: string | null;
  created_at: string;
  owner_id: string;
  owner_name?: string | null;
  image_count?: number;
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
  const [isMember, setIsMember] = useState<boolean>(false);
  const [isAnchor, setIsAnchor] = useState<boolean>(false);

  const [events, setEvents] = useState<EventRow[]>([]);
  const [posts, setPosts] = useState<PostPreview[]>([]);
  const [offers, setOffers] = useState<OfferPreview[]>([]);
  const [offerQ, setOfferQ] = useState('');

  // ===== Load current user + chapter, membership, events, posts, offers =====
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setMsg('');

      try {
        // who am I?
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id ?? null;
        if (!cancelled) setMeId(uid);

        // chapter by slug (active or visible per RLS)
        const { data: gRow, error: gErr } = await supabase
          .from('groups')
          .select('id,slug,name,about,city,country,status,created_by,created_at')
          .eq('slug', slug)
          .maybeSingle();

        if (gErr) throw gErr;
        if (!gRow || (gRow.status !== 'active' && uid !== gRow.created_by)) {
          // For now, only show active. Creators can see theirs even if pending.
          notFound();
          return;
        }
        if (!cancelled) setGroup(gRow as Group);

        // members (anchors first)
        const { data: mRows } = await supabase
          .from('group_members_with_names') // optional helper view; fallback below if missing
          .select('profile_id,role,display_name')
          .eq('group_id', gRow.id)
          .order('role', { ascending: true }) // anchors before members if view orders by role asc: anchor < member
          .order('display_name', { ascending: true });

        let memberList: Member[] = (mRows as any[]) || [];

        // Fallback if the helper view doesn't exist
        if (!mRows) {
          const { data: gm } = await supabase
            .from('group_members')
            .select('profile_id,role')
            .eq('group_id', gRow.id);

          const profileIds = (gm || []).map((r) => r.profile_id);
          let nameMap = new Map<string, string | null>();
          if (profileIds.length) {
            const { data: profs } = await supabase
              .from('profiles')
              .select('id,display_name')
              .in('id', profileIds);
            for (const p of (profs || []) as any[])
              nameMap.set(p.id, p.display_name ?? null);
          }
          memberList = (gm || []).map((r) => ({
            profile_id: r.profile_id,
            role: r.role,
            display_name: nameMap.get(r.profile_id) ?? null,
          }));
        }

        if (!cancelled) {
          setMembers(memberList.sort((a, b) => (a.role === 'anchor' && b.role !== 'anchor' ? -1 : 1)));
          const mine = uid ? memberList.find((m) => m.profile_id === uid) : undefined;
          setIsMember(!!mine);
          setIsAnchor(mine?.role === 'anchor');
        }

        // events (next 10) with RSVP status
        const { data: eRows } = await supabase
          .from('group_events')
          .select('id,title,description,starts_at,ends_at,location,is_online')
          .eq('group_id', gRow.id)
          .gte('starts_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString()) // include yesterday as buffer
          .order('starts_at', { ascending: true })
          .limit(10);

        let listEvents: EventRow[] = (eRows || []) as any[];

        // RSVP enrich: count + mine
        if (listEvents.length) {
          const eventIds = listEvents.map((e) => e.id);
          const [countsRes, mineRes] = await Promise.all([
            supabase
              .from('event_rsvps')
              .select('event_id')
              .in('event_id', eventIds),
            uid
              ? supabase
                  .from('event_rsvps')
                  .select('event_id')
                  .in('event_id', eventIds)
                  .eq('profile_id', uid)
              : Promise.resolve({ data: [] as any[] }),
          ]);

          const counts = new Map<string, number>();
          for (const r of ((countsRes.data || []) as any[])) {
            counts.set(r.event_id, (counts.get(r.event_id) || 0) + 1);
          }
          const mineSet = new Set<string>(((mineRes as any).data || []).map((r: any) => r.event_id));

          listEvents = listEvents.map((e) => ({
            ...e,
            rsvp_count: counts.get(e.id) || 0,
            i_rsvped: mineSet.has(e.id),
          }));
        }
        if (!cancelled) setEvents(listEvents);

        // posts (recent 10) scoped by group
        const { data: pRows } = await supabase
          .from('posts')
          .select('id,content,created_at,owner_id,images')
          .eq('group_id', gRow.id)
          .order('created_at', { ascending: false })
          .limit(10);

        let postList: PostPreview[] =
          (pRows || []).map((p: any) => ({
            id: p.id,
            content: p.content ?? null,
            created_at: p.created_at,
            owner_id: p.owner_id,
            image_count: Array.isArray(p.images) ? p.images.length : undefined,
          })) ?? [];

        if (postList.length) {
          const ownerIds = Array.from(new Set(postList.map((p) => p.owner_id)));
          const { data: profs } = await supabase
            .from('profiles')
            .select('id,display_name')
            .in('id', ownerIds);
          const nameMap = new Map<string, string | null>();
          for (const p of (profs || []) as any[]) nameMap.set(p.id, p.display_name ?? null);
          postList = postList.map((p) => ({ ...p, owner_name: nameMap.get(p.owner_id) ?? null }));
        }
        if (!cancelled) setPosts(postList);

        // offers (recent 10) scoped by group (active only)
        const { data: oRows } = await supabase
          .from('offers')
          .select('id,title,status,created_at,owner_id')
          .eq('group_id', gRow.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(10);

        let offerList: OfferPreview[] = (oRows || []) as any[];

        if (offerList.length) {
          const ownerIds = Array.from(new Set(offerList.map((o) => o.owner_id)));
          const { data: profs } = await supabase
            .from('profiles')
            .select('id,display_name')
            .in('id', ownerIds);
          const nameMap = new Map<string, string | null>();
          for (const p of (profs || []) as any[]) nameMap.set(p.id, p.display_name ?? null);
          offerList = offerList.map((o) => ({ ...o, owner_name: nameMap.get(o.owner_id) ?? null }));
        }
        if (!cancelled) setOffers(offerList);
      } catch (e: any) {
        console.error(e);
        if (!cancelled) setMsg(e?.message ?? 'Failed to load chapter.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const anchors = useMemo(
    () => members.filter((m) => m.role === 'anchor'),
    [members]
  );

  const filteredOffers = useMemo(() => {
    const q = offerQ.trim().toLowerCase();
    if (!q) return offers;
    return offers.filter((o) => o.title.toLowerCase().includes(q));
  }, [offers, offerQ]);

  // ===== Actions =====
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
            e.id === eventId
              ? { ...e, i_rsvped: true, rsvp_count: (e.rsvp_count || 0) + 1 }
              : e
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
            e.id === eventId
              ? { ...e, i_rsvped: false, rsvp_count: Math.max((e.rsvp_count || 1) - 1, 0) }
              : e
          )
        );
      }
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? 'Failed to update RSVP.');
    }
  }

  if (loading) {
    return <div className="max-w-5xl p-4 text-sm text-gray-600">Loading chapter…</div>;
  }

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
      {/* Cover + Header */}
      <section className="hx-card p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">
              {group.name}
            </h1>
            <div className="mt-1 text-sm text-gray-600">
              {group.city || group.country ? (
                <>
                  {group.city ? <span>{group.city}</span> : null}
                  {group.city && group.country ? <span>, </span> : null}
                  {group.country ? <span>{group.country}</span> : null}
                </>
              ) : (
                <span>Location: —</span>
              )}
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

        {group.about && (
          <p className="mt-4 max-w-prose text-gray-800 whitespace-pre-wrap">
            {group.about}
          </p>
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
      </section>

      {/* Events */}
      <section className="hx-card p-4 sm:p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Upcoming events</h2>
          {isAnchor && (
            <Link href={`/events/new?group=${group.id}`} className="hx-btn hx-btn--outline-primary">
              Create event
            </Link>
          )}
        </div>

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
                    {e.description && (
                      <p className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">{e.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">{e.rsvp_count ?? 0} going</span>
                    <button
                      onClick={() => toggleRsvp(e.id, e.i_rsvped)}
                      className={e.i_rsvped ? 'hx-btn hx-btn--secondary' : 'hx-btn hx-btn--primary'}
                    >
                      {e.i_rsvped ? 'Cancel RSVP' : 'RSVP'}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Posts (scoped by group) */}
      <section className="hx-card p-4 sm:p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent posts</h2>
          {isMember ? (
            <Link href={`/compose?group=${group.id}`} className="hx-btn hx-btn--outline-primary">
              Share to this chapter
            </Link>
          ) : (
            <span className="text-xs text-gray-600">Join to post</span>
          )}
        </div>

        {posts.length === 0 ? (
          <p className="text-sm text-gray-600">No posts yet.</p>
        ) : (
          <ul className="space-y-3">
            {posts.map((p) => (
              <li key={p.id} className="rounded border p-3">
                <div className="text-sm text-gray-600">
                  {p.owner_name || p.owner_id.slice(0, 8)} • {new Date(p.created_at).toLocaleString()}
                </div>
                {p.content && <p className="mt-2 whitespace-pre-wrap">{p.content}</p>}
                {!!p.image_count && (
                  <div className="mt-2 text-xs text-gray-600">{p.image_count} image{p.image_count > 1 ? 's' : ''}</div>
                )}
                <div className="mt-3">
                  <Link href={`/post/${p.id}`} className="hx-btn hx-btn--outline-primary">Open thread</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Offers (scoped by group) */}
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

      {msg && (
        <p className="text-sm text-amber-700">{msg}</p>
      )}
    </div>
  );
}
