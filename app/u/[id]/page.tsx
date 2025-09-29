// /app/u/[id]/page.tsx
'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import OfferCard, { type OfferRow } from '@/components/OfferCard';
import ProfileHeader from '@/components/ProfileHeader';
import UserFeed from '@/components/UserFeed';

type ProfileRow = {
  id: string;
  display_name: string | null;
  bio?: string | null;
  area_city?: string | null;
  area_country?: string | null;
  role?: 'user' | 'moderator' | 'admin' | null;
  created_at?: string | null;
  avatar_url?: string | null;
  cover_url?: string | null;
};

export const dynamic = 'force-dynamic';

function ProfileContent() {
  const { id: profileId } = useParams<{ id: string }>();

  const [me, setMe] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string>('');

  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setMsg('');

      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id ?? null;
        if (!cancelled) setMe(uid);

        const { data: p, error: pErr } = await supabase
          .from('profiles')
          .select(
            'id, display_name, bio, area_city, area_country, role, created_at, avatar_url, cover_url'
          )
          .eq('id', profileId)
          .single();
        if (pErr) throw pErr;
        if (!cancelled) setProfile(p as ProfileRow);

        const { data: o, error: oErr } = await supabase
          .from('offers')
          .select(
            'id, title, offer_type, is_online, city, country, images, status, created_at'
          )
          .eq('owner_id', profileId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(100);
        if (oErr) throw oErr;

        const ownerName = (p as any)?.display_name ?? '—';
        const list: OfferRow[] = (o || []).map((row: any) => ({
          id: row.id,
          title: row.title,
          offer_type: row.offer_type,
          is_online: row.is_online,
          city: row.city,
          country: row.country,
          status: row.status,
          images: row.images ?? [],
          owner_name: ownerName,
          // OfferCard supports this (harmless if unused)
          // @ts-ignore
          owner_id: String(profileId),
        }));

        if (!cancelled) setOffers(list);
      } catch (e: any) {
        if (!cancelled) setMsg(e?.message ?? 'Failed to load profile.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profileId]);

  const cityLine = useMemo(() => {
    if (!profile) return undefined;
    const parts = [profile.area_city, profile.area_country].filter(Boolean);
    return parts.length ? parts.join(', ') : undefined;
  }, [profile]);

  return (
    <section className="space-y-4">
      <ProfileHeader
        displayName={profile?.display_name || 'Profile'}
        city={cityLine}
        role={(profile?.role as any) || undefined}
        memberSince={profile?.created_at || undefined}
        avatarUrl={profile?.avatar_url || undefined}
        coverUrl={profile?.cover_url || undefined}
        canEdit={me === profile?.id}
        onEdit={() => (window.location.href = '/profile')}
      />

      {profile?.bio && (
        <p className="max-w-2xl whitespace-pre-wrap text-sm text-gray-700">{profile.bio}</p>
      )}

      {/* Match the /profile layout exactly so Vercel renders 2 columns the same */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        {/* Offers (left) */}
        <div className="md:col-span-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-semibold">Active Offers</h2>
            {me === profile?.id && (
              <Link href="/offers/new" className="text-xs underline">
                New offer
              </Link>
            )}
          </div>

          {msg && <p className="text-sm text-amber-700">{msg}</p>}
          {loading ? (
            <p className="text-sm text-gray-600">Loading…</p>
          ) : offers.length === 0 ? (
            <p className="text-sm text-gray-600">No active offers.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {offers.map((o) => (
                <OfferCard key={o.id} offer={o} />
              ))}
            </div>
          )}
        </div>

        {/* Posts (right) */}
        <div className="md:col-span-7">
          <UserFeed profileId={profileId} />
        </div>
      </div>
    </section>
  );
}

export default function PublicProfilePage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-600">Loading profile…</div>}>
      <ProfileContent />
    </Suspense>
  );
}
