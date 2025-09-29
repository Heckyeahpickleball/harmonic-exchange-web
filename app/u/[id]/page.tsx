// /app/u/[id]/page.tsx
'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import ProfileHeader from '@/components/ProfileHeader';
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

      if (!cancelled) {
        if (error) setProfile(null);
        else setProfile(data as ProfileRow);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

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
          .select(
            'id, title, offer_type, is_online, city, country, images, status, created_at'
          )
          .eq('owner_id', id)
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
            owner_id: undefined,
          })) ?? [];

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
    return () => {
      cancelled = true;
    };
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
      {/* Same header component as /profile for a consistent look */}
      <ProfileHeader profile={profile} isSelf={false} />

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
            {/* no “New offer” here */}
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

        {/* Posts (right) – read-only feed (no composer) */}
        <section className="space-y-2 md:col-span-7">
          <h2 className="text-base font-semibold">Posts</h2>
          <UserFeed profileId={profile.id} />
        </section>
      </div>
    </section>
  );
}
