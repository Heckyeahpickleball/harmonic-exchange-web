// components/ProfileHeader.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import BadgeCluster from '@/components/BadgeCluster';

type Profile = {
  id: string;
  full_name?: string | null;
  city?: string | null;
  country?: string | null;
  avatar_url?: string | null;
  cover_url?: string | null;
  created_at?: string | null;
  is_admin?: boolean | null;
};

type ExpandedBadge = {
  badge_code: string;
  label: string | null;
  track: 'give' | 'receive' | 'streak' | 'milestone' | null;
  tier: number | null;
  icon: string | null;
  earned_at: string;
};

interface ProfileHeaderProps {
  profile: Profile;
  isOwner?: boolean;
}

export default function ProfileHeader({ profile, isOwner = false }: ProfileHeaderProps) {
  const supabase = useMemo(() => createClientComponentClient(), []);
  const [badges, setBadges] = useState<ExpandedBadge[] | null>(null);
  const [loadingBadges, setLoadingBadges] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingBadges(true);
      setError(null);
      const { data, error } = await supabase
        .from('profile_badges_expanded')
        .select('badge_code,label,track,tier,icon,earned_at')
        .eq('profile_id', profile.id)
        .order('earned_at', { ascending: false });

      if (!alive) return;
      if (error) {
        setError(error.message);
        setBadges([]);
      } else {
        const normalized = (data ?? []).map((b) => ({
          ...b,
          icon: b.icon ?? '/badges/generic_badge.png',
        })) as ExpandedBadge[];
        setBadges(normalized);
      }
      setLoadingBadges(false);
    })();
    return () => {
      alive = false;
    };
  }, [supabase, profile?.id]);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Cover: real image if present; safe heights across breakpoints */}
      <div className="relative h-36 sm:h-44 md:h-56 w-full">
        {profile?.cover_url ? (
          <Image
            src={profile.cover_url}
            alt="Cover"
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 100vw"
            priority={false}
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-r from-slate-200 to-slate-100" />
        )}
      </div>

      {/* Header content */}
      <div className="px-4 sm:px-6 pb-4">
        {/* On mobile we avoid overlap by aligning avatar + name in a single row;
            on md+ the negative margin gives a tasteful overlap. */}
        <div className="mt-[-32px] sm:mt-[-40px] md:mt-[-48px] flex items-end gap-3 md:gap-4">
          {/* Avatar */}
          <div className="h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24 rounded-full border-4 border-white overflow-hidden bg-slate-100 shrink-0">
            {profile?.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={profile?.full_name || 'Avatar'}
                width={96}
                height={96}
                sizes="(max-width: 640px) 64px, 96px"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full w-full place-items-center text-slate-400 text-xl">🙂</div>
            )}
          </div>

          {/* Name + meta */}
          <div className="min-w-0 flex-1">
            {/* Name row */}
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-lg sm:text-xl md:text-2xl font-semibold">
                {profile?.full_name || 'Member'}
              </h1>
              {profile?.is_admin && (
                <span className="text-[11px] rounded-full border px-2 py-0.5 bg-emerald-50 border-emerald-200 text-emerald-700">
                  Admin
                </span>
              )}

              {/* Desktop/tablet inline badges — unchanged look */}
              <div className="ml-2 hidden min-w-[140px] flex-1 sm:block">
                {loadingBadges ? (
                  <span className="text-xs text-slate-500">Loading badges…</span>
                ) : error ? (
                  <span className="text-xs text-rose-600">Badges: {error}</span>
                ) : badges && badges.length > 0 ? (
                  <BadgeCluster badges={badges} size={24} href="/profile/badges" />
                ) : (
                  <span className="text-xs text-slate-500">No badges yet.</span>
                )}
              </div>

              {isOwner && (
                <Link
                  href="/profile/badges"
                  className="hidden sm:inline whitespace-nowrap text-xs text-emerald-700 hover:underline"
                >
                  Learn how to earn
                </Link>
              )}
            </div>

            {/* Meta */}
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-slate-600">
              {(profile?.city || profile?.country) && (
                <span>{[profile.city, profile.country].filter(Boolean).join(', ')}</span>
              )}
              {profile?.created_at && (
                <span>• Member since {new Date(profile.created_at).toLocaleDateString()}</span>
              )}
            </div>

            {/* Mobile badges: tighter spacing so 3 fit across without scrolling */}
            <div className="sm:hidden mt-3 -mx-2 px-2">
              {loadingBadges ? (
                <span className="text-xs text-slate-500">Loading badges…</span>
              ) : error ? (
                <span className="text-xs text-rose-600">Badges: {error}</span>
              ) : badges && badges.length > 0 ? (
                <div className="flex items-center justify-center gap-3">
                  {/* size 22 + small gap ensures 3 fit on 360–400px widths */}
                  <BadgeCluster badges={badges.slice(0, 3)} size={22} href="/profile/badges" />
                </div>
              ) : (
                <span className="text-xs text-slate-500">No badges yet.</span>
              )}

              {isOwner && (
                <div className="mt-2 text-center">
                  <Link href="/profile/badges" className="text-xs text-emerald-700 hover:underline">
                    Learn how to earn
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Owner action (desktop only) */}
          <div className="hidden sm:block">
            {isOwner && (
              <Link
                href="/profile/edit"
                className="inline-flex items-center rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
              >
                Edit Profile
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
