// /app/profile/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import OfferCard, { type OfferRow } from '@/components/OfferCard';
import UserFeed from '@/components/UserFeed';
import BadgeCluster from '@/components/BadgeCluster';

type ProfileRow = {
  id: string;
  display_name: string;
  area_city: string | null;
  area_country: string | null;
  skills: string[] | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  role?: 'user' | 'moderator' | 'admin';
  status?: 'active' | 'suspended';
  created_at?: string;
};

type ExpandedBadge = {
  badge_code: string;
  label: string | null;
  track: 'give' | 'receive' | 'streak' | 'milestone' | null;
  tier: number | null;
  icon: string | null;
  earned_at: string;
};

export default function ProfilePage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>('');
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersMsg, setOffersMsg] = useState('');

  const [badges, setBadges] = useState<ExpandedBadge[] | null>(null);
  const [badgesMsg, setBadgesMsg] = useState<string>('');

  // Mobile collapsible state (About + Skills)
  const [aboutOpen, setAboutOpen] = useState(false);

  // ----- Load current user + profile -----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setStatus('');
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userRes.user) {
        setLoading(false);
        return;
      }
      const u = userRes.user;
      if (cancelled) return;

      setUserEmail(u.email ?? u.phone ?? null);
      setUserId(u.id);

      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select(
          'id, display_name, area_city, area_country, skills, bio, avatar_url, cover_url, role, status, created_at'
        )
        .eq('id', u.id)
        .single();

      if (profErr) {
        setStatus(
          `Heads up: profile not found yet. Try Sign Out then Sign In again to create it. (${profErr.message})`
        );
        setLoading(false);
        return;
      }
      setProfile(prof as ProfileRow);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // ----- Load my active offers -----
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      setOffersLoading(true);
      setOffersMsg('');
      try {
        const { data, error } = await supabase
          .from('offers')
          .select('id, title, offer_type, is_online, city, country, images, status, created_at')
          .eq('owner_id', userId)
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        if (error) throw error;

        const shaped: OfferRow[] =
          (data ?? []).map((r: any) => ({
            id: r.id,
            title: r.title,
            offer_type: r.offer_type,
            is_online: r.is_online,
            city: r.city,
            country: r.country,
            status: r.status,
            images: r.images ?? [],
            owner_name: undefined,
          })) ?? [];

        if (!cancelled) setOffers(shaped);
      } catch (e: any) {
        if (!cancelled) {
          setOffers([]);
          setOffersMsg(e?.message ?? 'Failed to load your offers.');
        }
      } finally {
        if (!cancelled) setOffersLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [userId]);

  // ----- Load badges (expanded view) -----
  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;

    (async () => {
      setBadges(null);
      setBadgesMsg('');
      try {
        const { data, error } = await supabase
          .from('profile_badges_expanded')
          .select('badge_code,label,track,tier,icon,earned_at')
          .eq('profile_id', profile.id)
          .order('earned_at', { ascending: false });

        if (error) throw error;
        if (!cancelled) setBadges((data as ExpandedBadge[]) ?? []);
      } catch (e: any) {
        if (!cancelled) setBadgesMsg(e?.message ?? 'Failed to load badges.');
      }
    })();

    return () => { cancelled = true; };
  }, [profile?.id]);

  const clusterBadges = useMemo(() => {
    const list = (badges ?? []).filter((b) => {
      const tr = String(b.track ?? '');
      if (tr === 'streak') return true;
      return (b.tier ?? 0) > 0;
    });
    return list.map((b) => ({
      badge_code: b.badge_code,
      track: b.track ?? '',
      tier: b.tier ?? 0,
      earned_at: b.earned_at,
      image_url:
        b.icon ||
        (b.track === 'give' && (b.tier ?? 0) >= 1
          ? `/badges/give_rays_t${b.tier}.png`
          : b.track === 'receive' && (b.tier ?? 0) >= 1
          ? `/badges/receive_bowl_t${b.tier}.png`
          : b.track === 'streak'
          ? `/badges/streak_wave.png`
          : undefined),
      label: b.label ?? null,
    }));
  }, [badges]);

  const skillsList = useMemo(
    () => ((profile?.skills ?? []) as string[]).filter(Boolean),
    [profile?.skills]
  );

  // Carousel helpers (mobile/tablet)
  const railRef = useRef<HTMLDivElement | null>(null);
  const scrollBy = (dx: number) => railRef.current?.scrollBy({ left: dx, behavior: 'smooth' });

  if (loading) return <p className="p-4">Loading...</p>;

  if (!userEmail || !profile) {
    return (
      <section className="max-w-lg space-y-4 p-4">
        <h2 className="text-2xl font-bold">My Profile</h2>
        <p>You are not signed in.</p>
        <a className="underline" href="/sign-in">Go to Sign In</a>
      </section>
    );
  }

  return (
    <section className="space-y-4 p-0 md:p-4">
      {/* ===== Header card ===== */}
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
        <div className="relative px-4 pb-3 pt-2 md:px-6">
          {/* MOBILE: no absolute/overlap */}
          <div className="md:hidden flex items-end gap-3">
            <div className="h-16 w-16 rounded-full border-4 border-white overflow-hidden bg-slate-100 shrink-0 -mt-8">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-slate-400 text-xl">🙂</div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 leading-tight">
                <h1 className="truncate text-lg font-semibold">{profile.display_name || 'Unnamed'}</h1>
                {profile.role && (
                  <span className="rounded-full border px-2 py-0.5 text-[11px] capitalize text-gray-700">
                    {profile.role}
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap gap-2 text-[13px] text-gray-600">
                {profile.area_city || profile.area_country ? (
                  <span>{[profile.area_city, profile.area_country].filter(Boolean).join(', ')}</span>
                ) : (
                  <span>—</span>
                )}
                {profile.created_at && (
                  <>
                    <span>•</span>
                    <span>Member since {new Date(profile.created_at).toLocaleDateString()}</span>
                  </>
                )}
              </div>

              {/* Mobile badges: 3 across, tight spacing */}
              <div className="mt-2">
                {!!clusterBadges.length ? (
                  <BadgeCluster
                    badges={clusterBadges.slice(0, 3)}
                    size={22}
                    className="gap-3"
                    href="/profile/badges"
                  />
                ) : badgesMsg ? (
                  <p className="text-xs text-amber-700">{badgesMsg}</p>
                ) : null}
              </div>
            </div>
          </div>

          {/* DESKTOP/TABLET: original overlap style */}
          <div className="hidden md:grid md:grid-cols-12 md:items-start">
            <div className="absolute -top-10 left-4 h-24 w-24 overflow-hidden rounded-full border-4 border-white md:left-6">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center bg-slate-200 text-slate-500">☺</div>
              )}
            </div>

            {/* LEFT */}
            <div className="md:col-span-8 md:pl-28">
              <div className="flex flex-wrap items-center gap-2 leading-tight">
                <h1 className="text-2xl font-semibold">{profile.display_name || 'Unnamed'}</h1>
                {profile.role && (
                  <span className="rounded-full border px-2 py-0.5 text-xs capitalize text-gray-700">
                    {profile.role}
                  </span>
                )}
              </div>

              <div className="mt-0.5 flex flex-wrap gap-2 text-sm text-gray-600">
                {profile.area_city || profile.area_country ? (
                  <span>{[profile.area_city, profile.area_country].filter(Boolean).join(', ')}</span>
                ) : (
                  <span>—</span>
                )}
                {profile.created_at && (
                  <>
                    <span>•</span>
                    <span>Member since {new Date(profile.created_at).toLocaleDateString()}</span>
                  </>
                )}
              </div>
            </div>

            {/* RIGHT badges (unchanged desktop) */}
            <div className="md:col-span-4 md:relative md:h-[100px]">
              {!!clusterBadges.length ? (
                <div className="absolute inset-0 hidden items-center justify-end md:flex">
                  <BadgeCluster badges={clusterBadges} size={48} href="/profile/badges" className="gap-8" />
                </div>
              ) : badgesMsg ? (
                <p className="text-xs text-amber-700"> {badgesMsg} </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* ===== About + Skills ===== */}
      {(profile.bio || skillsList.length) && (
        <div className="rounded-xl border p-4">
          {/* Mobile collapsed: single preview line + centered chevron button */}
          <div className="md:hidden">
            <p className="truncate text-sm text-gray-800 text-center">
              {profile.bio || 'About & Skills'}
            </p>
            <div className="mt-2 flex items-center justify-center">
              <button
                onClick={() => setAboutOpen((v) => !v)}
                className="flex flex-col items-center"
                aria-expanded={aboutOpen}
                aria-controls="about-skill-panel"
                type="button"
              >
                <span className="grid h-8 w-8 place-items-center rounded-full border">
                  <svg
                    className={['h-4 w-4 transition-transform', aboutOpen ? 'rotate-180' : 'rotate-0'].join(' ')}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                  </svg>
                </span>
                <span className="mt-1 text-[11px] text-gray-600">{aboutOpen ? 'See less' : 'See more'}</span>
              </button>
            </div>

            {aboutOpen && (
              <div id="about-skill-panel" className="mt-3 space-y-3">
                {profile.bio && (
                  <>
                    <h3 className="text-sm font-semibold">About</h3>
                    <p className="whitespace-pre-wrap text-sm text-gray-800">{profile.bio}</p>
                  </>
                )}
                {skillsList.length > 0 && (
                  <div>
                    <h3 className="mb-1 text-sm font-semibold">Skills</h3>
                    <div className="flex flex-wrap gap-2">
                      {skillsList.map((s, i) => (
                        <span key={i} className="rounded-full border px-2 py-1 text-xs">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Desktop: unchanged (always open) */}
          <div className="hidden md:block">
            {profile.bio && (
              <>
                <h3 className="mb-1 text-sm font-semibold">About</h3>
                <p className="whitespace-pre-wrap text-sm text-gray-800">{profile.bio}</p>
              </>
            )}
            {skillsList.length > 0 && (
              <div className="mt-3">
                <h3 className="mb-1 text-sm font-semibold">Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {skillsList.map((s, i) => (
                    <span key={i} className="rounded-full border px-2 py-1 text-xs">{s}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== Two-column layout ===== */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        {/* Offers (left) */}
        <section className="space-y-2 md:col-span-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Active Offers</h2>
            <Link href="/offers/new" className="text-xs underline">New offer</Link>
          </div>

          {offersLoading && <p className="text-sm text-gray-600">Loading…</p>}
          {offersMsg && <p className="text-sm text-amber-700">{offersMsg}</p>}
          {!offersLoading && offers.length === 0 && (
            <p className="text-sm text-gray-600">No active offers yet.</p>
          )}

          {/* Mobile & tablet: carousel (visible up to lg) */}
          <div className="lg:hidden">
            {offers.length > 0 && (
              <div className="relative">
                <div className="absolute left-1 top-1/2 z-10 hidden xs:flex -translate-y-1/2">
                  <button
                    type="button"
                    onClick={() => scrollBy(-280)}
                    className="rounded-full bg-white/90 px-2 py-1 shadow hover:bg-white"
                    aria-label="Scroll left"
                  >
                    ‹
                  </button>
                </div>
                <div className="absolute right-1 top-1/2 z-10 hidden xs:flex -translate-y-1/2">
                  <button
                    type="button"
                    onClick={() => scrollBy(280)}
                    className="rounded-full bg-white/90 px-2 py-1 shadow hover:bg-white"
                    aria-label="Scroll right"
                  >
                    ›
                  </button>
                </div>

                <div
                  ref={railRef}
                  className="-mx-2 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-contain px-2 py-1 scrollbar-thin"
                  aria-label="Your offers carousel"
                >
                  {offers.map((o) => (
                    <div key={o.id} className="min-w-[260px] max-w-[280px] snap-start">
                      <OfferCard offer={o} mine />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Desktop: list/grid (visible from lg up) */}
          <div className="hidden lg:grid lg:grid-cols-1 lg:gap-3">
            {offers.map((o) => (
              <OfferCard key={o.id} offer={o} mine />
            ))}
          </div>
        </section>

        {/* Posts (right) */}
        <section className="space-y-2 md:col-span-7">
          <h2 className="text-base font-semibold">Posts</h2>
          {userId && <UserFeed profileId={userId} />}
        </section>
      </div>
    </section>
  );
}
