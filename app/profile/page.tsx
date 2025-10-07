// /app/profile/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import ImageCropperModal from '@/components/ImageCropperModal';
import OfferCard, { type OfferRow } from '@/components/OfferCard';
import UserFeed from '@/components/UserFeed';
import PostComposer from '@/components/PostComposer';
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

type FormState = {
  display_name: string;
  area_city: string;
  area_country: string;
  skillsCSV: string;
  bio: string;
  avatar_url: string | null;
  cover_url: string | null;
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
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<string>('');

  const [profile, setProfile] = useState<ProfileRow | null>(null);

  const [form, setForm] = useState<FormState>({
    display_name: '',
    area_city: '',
    area_country: '',
    skillsCSV: '',
    bio: '',
    avatar_url: null,
    cover_url: null,
  });

  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersMsg, setOffersMsg] = useState('');

  const [badges, setBadges] = useState<ExpandedBadge[] | null>(null);
  const [badgesMsg, setBadgesMsg] = useState<string>('');

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Cropper modal state
  const [cropper, setCropper] = useState<{
    src: string;
    aspect: number;
    targetWidth: number;
    targetHeight: number;
    kind: 'avatar' | 'cover';
    title: string;
  } | null>(null);

  // Mobile: collapse About+Skills
  const [aboutOpen, setAboutOpen] = useState(false);

  /** Upload helper to Supabase Storage and return public URL */
  async function uploadTo(bucket: 'avatars' | 'covers', file: File): Promise<string> {
    if (!userId) throw new Error('Not signed in');
    const path = `${userId}/${Date.now()}_${file.name}`;
    const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type,
    });
    if (upErr) throw upErr;
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  // Load current user + profile
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
        setStatus(`Heads up: profile not found yet. Try Sign Out then Sign In again to create it. (${profErr.message})`);
        setLoading(false);
        return;
      }

      const p = (prof as ProfileRow) ?? null;
      setProfile(p);

      setForm({
        display_name: p?.display_name ?? '',
        area_city: p?.area_city ?? '',
        area_country: p?.area_country ?? '',
        skillsCSV: Array.isArray(p?.skills) ? p!.skills!.join(', ') : '',
        bio: p?.bio ?? '',
        avatar_url: p?.avatar_url ?? null,
        cover_url: p?.cover_url ?? null,
      });

      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Load my active offers
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

  // Load badges
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

  // ExpandedBadge -> BadgeCluster props
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
    () =>
      (form.skillsCSV || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    [form.skillsCSV]
  );

  // SSR-stable "member since"
  const memberSince = useMemo(() => {
    if (!profile?.created_at) return null;
    const d = new Date(profile.created_at);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(d);
  }, [profile?.created_at]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;

    const display_name = form.display_name.trim();
    if (!display_name) {
      setStatus('Display name is required.');
      return;
    }

    const skills = (form.skillsCSV || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    setSaving(true);
    setStatus('Saving...');

    const { data, error } = await supabase
      .from('profiles')
      .update({
        display_name,
        area_city: form.area_city.trim() || null,
        area_country: form.area_country.trim() || null,
        bio: form.bio.trim() || null,
        skills,
        avatar_url: form.avatar_url,
        cover_url: form.cover_url,
      })
      .eq('id', userId)
      .select(
        'id, display_name, area_city, area_country, skills, bio, avatar_url, cover_url, role, status, created_at'
      )
      .single();

    setSaving(false);

    if (error) {
      setStatus(`Save failed: ${error.message}`);
    } else {
      setProfile(data as ProfileRow);
      setStatus('Saved! ✅');
      setEditing(false);
    }
  }

  // Carousel helpers (mobile)
  const railRef = useRef<HTMLDivElement | null>(null);
  const scrollBy = (dx: number) => railRef.current?.scrollBy({ left: dx, behavior: 'smooth' });

  if (loading) return <p className="p-4">Loading...</p>;

  if (!userEmail) {
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
      {/* Header card */}
      <div className="overflow-hidden rounded-xl border">
        {/* Cover */}
        <div className="relative h-40 w-full md:h-56">
          {form.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.cover_url} alt="Cover" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-r from-slate-200 to-slate-100" />
          )}

          {/* Mobile edit button on cover (pencil) */}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="md:hidden absolute bottom-2 right-2 grid h-9 w-9 place-items-center rounded-full bg-white/95 shadow border"
            aria-label="Edit profile"
            title="Edit profile"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" />
              <path d="M14.06 4.94l3.75 3.75" />
            </svg>
          </button>
        </div>

        {/* Header content */}
        <div className="relative px-4 pb-3 pt-2 md:px-6">
          {/* MOBILE */}
          <div className="md:hidden relative">
            {/* Avatar — nudged a tad left */}
            <div className="absolute -top-12 left-0.5 h-24 w-24 rounded-full border-4 border-white overflow-hidden bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={form.avatar_url || '/images/placeholder-avatar.png'}
                alt="Avatar"
                className="h-full w-full object-cover"
              />
            </div>

            {/* Name row — tiny gap under cover */}
            <div className="pl-[123px] mt-0">
              <div className="flex items-end gap-2">
                <h1 className="truncate text-[25px] leading-[1.1] font-bold">{form.display_name || 'Unnamed'}</h1>
                {profile?.role && (
                  <span className="mb-[2px] rounded-full border px-2 py-0.5 text-[10px] capitalize text-gray-700">
                    {profile.role}
                  </span>
                )}
              </div>
            </div>

            {/* Location + Member since */}
            <div className="pl-[116px] mt-0.5 text-[12px] text-gray-600 whitespace-nowrap overflow-hidden text-ellipsis">
              {form.area_city || form.area_country
                ? [form.area_city, form.area_country].filter(Boolean).join(', ')
                : '—'}
              {memberSince && ` • Member since ${memberSince}`}
            </div>

            {/* Badges — centered line */}
            {!!clusterBadges.length && (
              <div className="mt-1 flex justify-center">
                <BadgeCluster
                  badges={clusterBadges.slice(0, 3)}
                  size={48}
                  className="gap-1.5"
                  href="/profile/badges"
                />
              </div>
            )}
            {!clusterBadges.length && badgesMsg && (
              <p className="text-xs text-amber-700 mt-1 text-center">{badgesMsg}</p>
            )}
          </div>

          {/* DESKTOP/TABLET (unchanged) */}
          <div className="hidden md:grid md:grid-cols-12 md:items-start">
            <div className="absolute -top-10 left-4 h-24 w-24 overflow-hidden rounded-full border-4 border-white md:left-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={form.avatar_url || '/images/placeholder-avatar.png'}
                alt="Avatar"
                className="h-full w-full object-cover"
              />
            </div>

            <div className="md:col-span-8 md:pl-28">
              <div className="flex flex-wrap items-center gap-2 leading-tight">
                <h1 className="text-2xl font-semibold">{form.display_name || 'Unnamed'}</h1>
                {profile?.role && (
                  <span className="rounded-full border px-2 py-0.5 text-xs capitalize text-gray-700">{profile.role}</span>
                )}
              </div>

              <div className="mt-0.5 flex flex-wrap gap-2 text-sm text-gray-600">
                {form.area_city || form.area_country ? (
                  <span>{[form.area_city, form.area_country].filter(Boolean).join(', ')}</span>
                ) : (
                  <span>—</span>
                )}
                {memberSince && (
                  <>
                    <span>•</span>
                    <span>Member since {memberSince}</span>
                  </>
                )}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button onClick={() => setEditing(true)} className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50">
                  Edit Profile
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    location.href = '/';
                  }}
                  className="rounded border px-3 py-1.5 text-sm"
                >
                  Sign Out
                </button>
              </div>
            </div>

            <div className="md:col-span-4 md:relative md:h-[100px]">
              {!!clusterBadges.length ? (
                <div className="absolute inset-0 hidden items-center justify-end md:flex">
                  <BadgeCluster badges={clusterBadges} size={48} href="/profile/badges" className="gap-8" />
                </div>
              ) : badgesMsg ? (
                <p className="text-xs text-amber-700">{badgesMsg}</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* About + Skills (mobile collapsed) */}
      {(form.bio || skillsList.length) && (
        <div className="relative rounded-xl border px-4 pt-0 pb-4">
          <div className="md:hidden">
            {!aboutOpen ? (
              <h3 className="text-center text-sm font-semibold">About</h3>
            ) : (
              <div id="about-skill-panel" className="space-y-3 pt-2">
                {form.bio && <p className="whitespace-pre-wrap text-sm text-gray-800">{form.bio}</p>}
                {skillsList.length > 0 && (
                  <div>
                    <h4 className="mb-1 text-sm font-semibold">Skills</h4>
                    <div className="flex flex-wrap gap-2">
                      {skillsList.map((s, i) => (
                        <span key={i} className="rounded-full border px-2 py-1 text-xs">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setAboutOpen((v) => !v)}
              className="absolute left-1/2 -translate-x-1/2 -bottom-3 grid h-7 w-7 place-items-center rounded-full border bg-white shadow"
              aria-expanded={aboutOpen}
              aria-controls="about-skill-panel"
              type="button"
              title={aboutOpen ? 'See less' : 'See more'}
            >
              <svg
                className={['h-3.5 w-3.5 transition-transform', aboutOpen ? 'rotate-180' : 'rotate-0'].join(' ')}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
              </svg>
            </button>
          </div>

          {/* Desktop: unchanged */}
          <div className="hidden md:block">
            {form.bio && (
              <>
                <h3 className="mb-1 text-sm font-semibold">About</h3>
                <p className="whitespace-pre-wrap text-sm text-gray-800">{form.bio}</p>
              </>
            )}
            {skillsList.length > 0 && (
              <div className="mt-3">
                <h3 className="mb-1 text-sm font-semibold">Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {skillsList.map((s, i) => (
                    <span key={i} className="rounded-full border px-2 py-1 text-xs">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {status && <p className="px-1 text-sm text-gray-700">{status}</p>}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        {/* Offers (left) */}
        <section className="space-y-2 md:col-span-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Active Offers</h2>
            <Link href="/offers/new" className="text-xs underline">
              New offer
            </Link>
          </div>

          {offersLoading && <p className="text-sm text-gray-600">Loading…</p>}
          {offersMsg && <p className="text-sm text-amber-700">{offersMsg}</p>}
          {!offersLoading && offers.length === 0 && <p className="text-sm text-gray-600">No active offers yet.</p>}

          {/* Mobile carousel */}
          <div className="md:hidden">
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
                      <OfferCard
                        offer={o}
                        mine
                        onDeleted={(id) => setOffers((prev) => prev.filter((x) => x.id !== id))}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Desktop grid */}
          <div className="hidden md:grid md:grid-cols-1 md:gap-3">
            {offers.map((o) => (
              <OfferCard
                key={o.id}
                offer={o}
                mine
                onDeleted={(id) => setOffers((prev) => prev.filter((x) => x.id !== id))}
              />
            ))}
          </div>
        </section>

        {/* Posts (right) */}
        <section className="space-y-2 md:col-span-7">
          <h2 className="text-base font-semibold">Posts</h2>
          {userId && <PostComposer profileId={userId} />}
          {userId && <UserFeed profileId={userId} />}
        </section>
      </div>

      {/* EDIT DIALOG — now scrollable */}
      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-4 shadow-xl max-h-[85vh] overflow-y-auto">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Edit Profile</h3>
              <button onClick={() => setEditing(false)} className="rounded border px-2 py-1 text-sm hover:bg-gray-50">
                Close
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSave(e);
              }}
              className="grid gap-4 md:grid-cols-2"
            >
              {/* LEFT column */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium">Display name *</label>
                  <input
                    className="mt-1 w-full rounded border p-2"
                    value={form.display_name}
                    onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                    placeholder="e.g., Sara W."
                    required
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium">City</label>
                    <input
                      className="mt-1 w-full rounded border p-2"
                      value={form.area_city}
                      onChange={(e) => setForm({ ...form, area_city: e.target.value })}
                      placeholder="Ottawa"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">Country</label>
                    <input
                      className="mt-1 w-full rounded border p-2"
                      value={form.area_country}
                      onChange={(e) => setForm({ ...form, area_country: e.target.value })}
                      placeholder="Canada"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium">Skills (comma-separated)</label>
                  <input
                    className="mt-1 w-full rounded border p-2"
                    value={form.skillsCSV}
                    onChange={(e) => setForm({ ...form, skillsCSV: e.target.value })}
                    placeholder="coaching, event planning, web design"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium">Short bio</label>
                  <textarea
                    className="mt-1 w-full rounded border p-2"
                    rows={5}
                    value={form.bio}
                    onChange={(e) => setForm({ ...form, bio: e.target.value })}
                    placeholder="What you care about and want to gift to the community..."
                  />
                </div>
              </div>

              {/* RIGHT column */}
              <div className="space-y-4">
                {/* Cover */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Cover photo</label>
                  {form.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.cover_url} alt="Cover" className="max-h-40 w-full rounded border object-cover" />
                  ) : (
                    <div className="rounded border p-4 text-sm text-gray-500">No cover set</div>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => coverInputRef.current?.click()}
                      className="rounded px-3 py-2 text-sm border bg-[var(--hx-brand,#0f766e)] text-white hover:opacity-90"
                    >
                      Upload cover
                    </button>
                    <input
                      ref={coverInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.currentTarget.files?.[0];
                        if (!file) return;
                        const src = URL.createObjectURL(file);
                        setCropper({
                          src,
                          aspect: 3,
                          targetWidth: 1200,
                          targetHeight: 400,
                          kind: 'cover',
                          title: 'Position your cover',
                        });
                        e.currentTarget.value = '';
                      }}
                    />
                  </div>
                </div>

                {/* Avatar */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Profile picture</label>
                  {form.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.avatar_url} alt="Avatar" className="h-32 w-32 rounded-full border object-cover" />
                  ) : (
                    <div className="grid h-32 w-32 place-items-center rounded-full border text-sm text-gray-500">
                      No avatar
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="rounded px-3 py-2 text-sm border bg-[var(--hx-brand,#0f766e)] text-white hover:opacity-90"
                    >
                      Upload photo
                    </button>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.currentTarget.files?.[0];
                        if (!file) return;
                        const src = URL.createObjectURL(file);
                        setCropper({
                          src,
                          aspect: 1,
                          targetWidth: 512,
                          targetHeight: 512,
                          kind: 'avatar',
                          title: 'Position your photo',
                        });
                        e.currentTarget.value = '';
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 mt-2 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded bg-[var(--hx-brand,#0f766e)] px-4 py-2 text-white disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save Profile'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="rounded border px-4 py-2"
                >
                  Cancel
                </button>
                {status && <span className="text-sm text-gray-700">{status}</span>}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Cropper dialog */}
      {cropper && (
        <ImageCropperModal
          src={cropper.src}
          aspect={cropper.aspect}
          targetWidth={cropper.targetWidth}
          targetHeight={cropper.targetHeight}
          title={cropper.title}
          onCancel={() => setCropper(null)}
          onConfirm={async (blob) => {
            try {
              const file = new File([blob], `${cropper.kind}.jpg`, { type: 'image/jpeg' });
              const url = await uploadTo(cropper.kind === 'avatar' ? 'avatars' : 'covers', file);
              if (cropper.kind === 'avatar') {
                setForm((f) => ({ ...f, avatar_url: url }));
              } else {
                setForm((f) => ({ ...f, cover_url: url }));
              }
              setCropper(null);
            } catch (err: any) {
              setStatus(err?.message ?? 'Upload failed');
              setCropper(null);
            }
          }}
        />
      )}
    </section>
  );
}
