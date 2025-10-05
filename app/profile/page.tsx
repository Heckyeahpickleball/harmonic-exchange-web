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

  // Badges
  const [badges, setBadges] = useState<ExpandedBadge[] | null>(null);
  const [badgesMsg, setBadgesMsg] = useState<string>('');

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [cropper, setCropper] = useState<{
    src: string;
    aspect: number;
    targetWidth: number;
    targetHeight: number;
    kind: 'avatar' | 'cover';
    title: string;
  } | null>(null);

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
        setStatus(
          `Heads up: profile not found yet. Try Sign Out then Sign In again to create it. (${profErr.message})`
        );
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
    return () => {
      cancelled = true;
    };
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

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Load badges for this profile (from the expanded view)
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

    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  // Map ExpandedBadge -> BadgeCluster’s expected shape
  const clusterBadges = useMemo(
    () =>
      (badges ?? []).map((b) => ({
        badge_code: b.badge_code,
        track: b.track ?? '',
        tier: b.tier ?? 0,
        earned_at: b.earned_at,
        image_url: b.icon ?? undefined,
        label: b.label ?? null,
      })),
    [badges]
  );

  const skillsList = useMemo(
    () =>
      (form.skillsCSV || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    [form.skillsCSV]
  );

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
            <img src={form.cover_url} alt="Cover" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-r from-slate-200 to-slate-100" />
          )}
        </div>

        {/* Header content – tightened paddings */}
        <div className="relative px-4 pb-3 pt-8 md:px-6">
          {/* Avatar (unchanged size/position) */}
          <div className="absolute -top-10 left-4 h-20 w-20 overflow-hidden rounded-full border-4 border-white md:left-6 md:h-24 md:w-24">
            {form.avatar_url ? (
              <img src={form.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center bg-slate-200 text-slate-500">☺</div>
            )}
          </div>

          {/* New compact header layout: left (name/meta/actions) | right (badges) */}
          <div className="grid grid-cols-1 gap-2 md:grid-cols-12 md:items-start">
            {/* LEFT */}
            <div className="md:col-span-8 md:pl-28">
              {/* Name row – smaller gaps/margins */}
              <div className="flex flex-wrap items-center gap-2 leading-tight">
                <h1 className="text-xl font-semibold md:text-2xl">{form.display_name || 'Unnamed'}</h1>
                {profile?.role && (
                  <span className="rounded-full border px-2 py-0.5 text-xs capitalize text-gray-700">
                    {profile.role}
                  </span>
                )}
              </div>

              {/* Meta – pulled closer */}
              <div className="mt-0.5 text-[13px] text-gray-600 flex flex-wrap gap-2">
                {form.area_city || form.area_country ? (
                  <span>{[form.area_city, form.area_country].filter(Boolean).join(', ')}</span>
                ) : (
                  <span>—</span>
                )}
                {profile?.created_at && (
                  <>
                    <span>•</span>
                    <span>Member since {new Date(profile.created_at).toLocaleDateString()}</span>
                  </>
                )}
              </div>

              {/* Actions – tight spacing */}
              <div className="mt-1.5 flex items-center gap-2">
                <button
                  onClick={() => setEditing(true)}
                  className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
                >
                  Edit Profile
                </button>
                <button
                  type="button"
                  onClick={async () => { await supabase.auth.signOut(); location.href='/'; }}
                  className="rounded border px-3 py-1.5 text-sm"
                >
                  Sign Out
                </button>
              </div>
            </div>

            {/* RIGHT: badges with captions, evenly spaced single-row */}
            <div className="md:col-span-4">
              {!!clusterBadges.length ? (
                <div className="flex items-start justify-start md:justify-end">
                  <BadgeCluster
                    badges={clusterBadges}
                    size={48}
                    href="/profile/badges"
                    className="gap-6 md:gap-8"
                  />
                </div>
              ) : badgesMsg ? (
                <p className="text-xs text-amber-700">{badgesMsg}</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* About / Skills */}
      {(form.bio || skillsList.length) && (
        <div className="rounded-xl border p-4">
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
                  <span key={i} className="rounded-full border px-2 py-1 text-xs">{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {status && <p className="px-1 text-sm text-gray-700">{status}</p>}

      {/* ===== Main content: Offers (left) + Posts (right) ===== */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        {/* Offers column */}
        <section className="md:col-span-5 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Active Offers</h2>
            <Link href="/offers/new" className="text-xs underline">New offer</Link>
          </div>

          {offersLoading && <p className="text-sm text-gray-600">Loading…</p>}
          {offersMsg && <p className="text-sm text-amber-700">{offersMsg}</p>}

          {!offersLoading && offers.length === 0 && (
            <p className="text-sm text-gray-600">No active offers yet.</p>
          )}

          <div className="grid grid-cols-1 gap-3">
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

        {/* Posts column */}
        <section className="md:col-span-7 space-y-2">
          <h2 className="text-base font-semibold">Posts</h2>
          {userId && <PostComposer profileId={userId} />}
          {userId && <UserFeed profileId={userId} />}
        </section>
      </div>

      {/* ----- EDIT DIALOG ----- */}
      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-4 shadow-xl">
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
              {/* left column */}
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

              {/* right column */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Cover photo</label>
                  {form.cover_url ? (
                    <img src={form.cover_url} alt="Cover" className="max-h-40 w-full rounded border object-cover" />
                  ) : (
                    <div className="rounded border p-4 text-sm text-gray-500">No cover set</div>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => coverInputRef.current?.click()}
                      className="rounded border px-3 py-2 text-sm hover:bg-gray-50"
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

                <div className="space-y-2">
                  <label className="text-sm font-medium">Profile picture</label>
                  {form.avatar_url ? (
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
                      className="rounded border px-3 py-2 text-sm hover:bg-gray-50"
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
                  className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
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
              </div>
            </form>

            {status && <p className="mt-3 text-sm text-gray-700">{status}</p>}
          </div>
        </div>
      )}

      {/* Cropper modal */}
      {cropper && (
        <ImageCropperModal
          src={cropper.src}
          aspect={cropper.aspect}
          targetWidth={cropper.targetWidth}
          targetHeight={cropper.targetHeight}
          title={cropper.title}
          onCancel={() => {
            URL.revokeObjectURL(cropper.src);
            setCropper(null);
          }}
          onConfirm={async (file) => {
            try {
              setStatus(`Uploading ${cropper.kind}…`);
              const url = await uploadTo(cropper.kind === 'avatar' ? 'avatars' : 'covers', file);
              if (cropper.kind === 'avatar') {
                setForm((f) => ({ ...f, avatar_url: url }));
                setStatus('Avatar uploaded');
              } else {
                setForm((f) => ({ ...f, cover_url: url }));
                setStatus('Cover uploaded');
              }
            } catch (err: any) {
              setStatus(`${cropper.kind} upload failed: ${err?.message ?? err}`);
            } finally {
              URL.revokeObjectURL(cropper.src);
              setCropper(null);
            }
          }}
        />
      )}
    </section>
  );
}
