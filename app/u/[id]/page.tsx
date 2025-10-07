// /app/u/[id]/page.tsx
'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import OfferCard, { type OfferRow } from '@/components/OfferCard';
import UserFeed from '@/components/UserFeed';

type ProfileRow = {
  id: string;
  display_name: string;
  area_city: string | null;
  area_country: string | null;
  bio: string | null;
  skills: string[] | null;
  avatar_url: string | null;
  cover_url: string | null;
  role?: 'user' | 'moderator' | 'admin';
  status?: 'active' | 'suspended';
  created_at?: string;
};

type ExpandedBadgeRow = {
  profile_id: string;
  badge_code: string | null;
  label: string | null;
  track: 'give' | 'receive' | 'streak' | 'milestone' | null;
  tier: number | null;
  earned_at: string | null;
};

export default function PublicProfilePage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-600">Loading…</div>}>
      <ProfileContent />
    </Suspense>
  );
}

function ProfileContent() {
  const { id } = useParams<{ id: string }>();

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [msg, setMsg] = useState<string>('');

  // badges (public view)
  const [badges, setBadges] = useState<ExpandedBadgeRow[]>([]);
  const [badgesMsg, setBadgesMsg] = useState<string>('');

  // load profile
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'id, display_name, area_city, area_country, bio, skills, avatar_url, cover_url, role, status, created_at'
        )
        .eq('id', id)
        .single();

      if (!cancelled) setProfile(error ? null : (data as ProfileRow));
    })();
    return () => { cancelled = true; };
  }, [id]);

  // load public badges for this profile
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setBadgesMsg('');
      try {
        const { data, error } = await supabase
          .from('profile_badges_expanded')
          .select('profile_id,badge_code,label,track,tier,earned_at')
          .eq('profile_id', id);

        if (error) throw error;
        if (!cancelled) setBadges((data as ExpandedBadgeRow[]) ?? []);
      } catch (e: any) {
        if (!cancelled) {
          setBadges([]);
          setBadgesMsg('Badges unavailable');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  // choose highest tier per track and map to public PNGs
  const badgeIcons = useMemo(() => {
    const best: Record<string, ExpandedBadgeRow | undefined> = {};
    for (const b of badges) {
      const tr = (b.track ?? '').toLowerCase();
      if (!tr) continue;
      if (tr === 'streak') {
        best.streak = b;
        continue;
      }
      if (tr === 'give' || tr === 'receive') {
        const prev = best[tr];
        if (!prev || (b.tier ?? 0) > (prev.tier ?? 0)) best[tr] = b;
      }
    }

    const out: { key: string; src: string; title: string; caption: string }[] = [];
    if (best.streak) {
      out.push({ key: 'streak', src: '/badges/streak_wave.png', title: 'Streak', caption: 'Streak' });
    }
    if (best.give && (best.give.tier ?? 0) > 0) {
      out.push({
        key: `give-${best.give.tier}`,
        src: `/badges/give_rays_t${best.give.tier}.png`,
        title: `Giver • Tier ${best.give.tier}`,
        caption: 'Giver',
      });
    }
    if (best.receive && (best.receive.tier ?? 0) > 0) {
      out.push({
        key: `receive-${best.receive.tier}`,
        src: `/badges/receive_bowl_t${best.receive.tier}.png`,
        title: `Receiver • Tier ${best.receive.tier}`,
        caption: 'Receiver',
      });
    }
    return out;
  }, [badges]);

  // load active offers by this owner
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoadingOffers(true);
      setMsg('');
      try {
        const { data, error } = await supabase
          .from('offers')
          .select('id, title, offer_type, is_online, city, country, images, status, created_at')
          .eq('owner_id', id)
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        if (error) throw error;

        const shaped: OfferRow[] = (data ?? []).map((r: any) => ({
          id: r.id,
          title: r.title,
          offer_type: r.offer_type,
          is_online: r.is_online,
          city: r.city,
          country: r.country,
          status: r.status,
          images: r.images ?? [],
        }));

        if (!cancelled) setOffers(shaped);
      } catch (e: any) {
        if (!cancelled) {
          setOffers([]);
          setMsg(e?.message ?? 'Failed to load offers.');
        }
      } finally {
        if (!cancelled) setLoadingOffers(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (!profile) {
    return (
      <section className="max-w-5xl">
        <p className="p-4 text-sm text-red-700">Profile not found.</p>
        <p className="px-4">
          <Link href="/offers" className="underline">← Back to Browse</Link>
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl space-y-4">
      {/* Header card (read-only) */}
      <div className="overflow-hidden rounded-xl border">
        {/* Cover */}
        <div className="relative h-40 w-full md:h-56">
          {profile.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.cover_url} alt="Cover" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-r from-slate-200 to-slate-100" />
          )}
        </div>

        {/* Header content */}
        <div className="relative px-4 pb-4 pt-12 md:px-8">
          {/* Avatar */}
          <div className="absolute -top-10 left-4 h-20 w-20 overflow-hidden rounded-full border-4 border-white md:left-6 md:h-24 md:w-24">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center bg-slate-200 text-slate-500">☺</div>
            )}
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            {/* LEFT: name + meta */}
            <div className="mt-2 md:mt-0 md:pl-24">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold md:text-2xl">
                  {profile.display_name || 'Unnamed'}
                </h1>
                {profile.role && (
                  <span className="rounded-full border px-2 py-0.5 text-xs capitalize text-gray-700">
                    {profile.role}
                  </span>
                )}
              </div>
              <div className="mt-1 text-sm text-gray-600">
                {profile.area_city || profile.area_country ? (
                  <span>{[profile.area_city, profile.area_country].filter(Boolean).join(', ')}</span>
                ) : (
                  <span>—</span>
                )}
                {profile.created_at && (
                  <>
                    <span className="mx-2">•</span>
                    <span>Member since {new Date(profile.created_at).toLocaleDateString()}</span>
                  </>
                )}
              </div>
            </div>

            {/* RIGHT: badges (desktop right-aligned; mobile centered + scrollable) */}
            <div className="mt-3 md:mt-0 md:pr-2">
              {badgesMsg && <span className="text-xs text-amber-700">{badgesMsg}</span>}
              {badgeIcons.length > 0 && (
                <div
                  className="
                    -mx-2 px-2
                    flex items-center gap-4 md:gap-6
                    justify-center md:justify-end
                    overflow-x-auto md:overflow-visible overscroll-contain
                    snap-x snap-mandatory md:snap-none scrollbar-thin
                  "
                  aria-label="Badges"
                >
                  {badgeIcons.map((b) => (
                    <div key={b.key} className="flex flex-col items-center snap-start">
                      <Link
                        href={`/profile/badges?id=${profile.id}`}
                        title={`See all badges — ${b.title}`}
                        aria-label={`See all badges — ${b.title}`}
                        className="rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={b.src}
                          alt={b.title}
                          width={44}
                          height={44}
                          className="h-9 w-9 md:h-11 md:w-11 rounded-full"
                          loading="lazy"
                          decoding="async"
                        />
                      </Link>
                      <span className="mt-0.5 md:mt-1 text-[11px] md:text-xs text-gray-700">{b.caption}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* About/skills (read-only) */}
      {(profile.bio || (profile.skills?.length ?? 0) > 0) && (
        <div className="rounded-xl border p-4">
          {profile.bio && (
            <>
              <h3 className="mb-1 text-sm font-semibold">About</h3>
              <p className="whitespace-pre-wrap text-sm text-gray-800">{profile.bio}</p>
            </>
          )}
          {(profile.skills?.length ?? 0) > 0 && (
            <div className="mt-3">
              <h3 className="mb-1 text-sm font-semibold">Skills</h3>
              <div className="flex flex-wrap gap-2">
                {profile.skills!.map((s, i) => (
                  <span key={i} className="rounded-full border px-2 py-1 text-xs">{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Two-column layout to match /profile */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        {/* Offers (left) */}
        <section className="space-y-2 md:col-span-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Active Offers</h2>
          </div>

          {loadingOffers && <p className="text-sm text-gray-600">Loading…</p>}
          {msg && <p className="text-sm text-amber-700">{msg}</p>}
          {!loadingOffers && offers.length === 0 && (
            <p className="text-sm text-gray-600">No active offers yet.</p>
          )}

          <div className="grid grid-cols-1 gap-3">
            {offers.map((o) => (
              <OfferCard key={o.id} offer={o} />
            ))}
          </div>
        </section>

        {/* Posts (right) – read-only feed */}
        <section className="space-y-2 md:col-span-7">
          <h2 className="text-base font-semibold">Posts</h2>
          <UserFeed profileId={profile.id} />
        </section>
      </div>
    </section>
  );
}
