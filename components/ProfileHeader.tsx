// components/ProfileHeader.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import EarnedBadgesRow, { type ExpandedBadge } from '@/components/EarnedBadgesRow';

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

interface ProfileHeaderProps {
  profile: Profile;
  isOwner?: boolean;
}

export default function ProfileHeader({ profile, isOwner = false }: ProfileHeaderProps) {
  const supabase = useMemo(() => createClientComponentClient(), []);
  const [badges, setBadges] = useState<ExpandedBadge[] | null>(null);
  const [loadingBadges, setLoadingBadges] = useState<boolean>(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingBadges(true);
      const { data, error } = await supabase
        .from('profile_badges_expanded')
        .select('badge_code,label,track,tier,icon,earned_at')
        .eq('profile_id', profile.id)
        .order('earned_at', { ascending: false });

      if (!alive) return;
      if (error) {
        setBadges([]);
      } else {
        setBadges((data ?? []) as any);
      }
      setLoadingBadges(false);
    })();
    return () => {
      alive = false;
    };
  }, [supabase, profile?.id]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Cover: taller on desktop, safe on mobile so text never collides */}
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

      {/* Content */}
      <div className="px-4 sm:px-6 pb-4">
        {/* Mobile: avatar + name side-by-side to avoid overlap; Desktop: classic overlap look */}
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
              <div className="h-full w-full grid place-items-center text-slate-400 text-xl">🙂</div>
            )}
          </div>

          {/* Name + meta */}
          <div className="flex-1 min-w-0">
            {/* Name row */}
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg sm:text-xl md:text-2xl font-semibold truncate">
                {profile?.full_name || 'Member'}
              </h1>
              {profile?.is_admin ? (
                <span className="text-[11px] rounded-full border px-2 py-0.5 bg-emerald-50 border-emerald-200 text-emerald-700">
                  Admin
                </span>
              ) : null}
            </div>

            {/* Meta */}
            <div className="mt-0.5 text-xs sm:text-sm text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-1">
              {(profile?.city || profile?.country) && (
                <span>{[profile.city, profile.country].filter(Boolean).join(', ')}</span>
              )}
              {profile?.created_at && (
                <span>• Member since {new Date(profile.created_at).toLocaleDateString()}</span>
              )}
            </div>
          </div>
        </div>

        {/* Badges: tight spacing so 3 fit on small screens without scroll */}
        <div className="mt-3">
          {loadingBadges ? (
            <span className="text-xs text-slate-500">Loading badges…</span>
          ) : badges && badges.length > 0 ? (
            <div className="flex items-center justify-center sm:justify-start">
              {/* size 26 + small gap ensures 3 fit across a 360–400px viewport */}
              <EarnedBadgesRow badges={badges} size={26} showTitles={true} className="gap-3 sm:gap-2" />
            </div>
          ) : (
            <span className="text-xs text-slate-500">No badges yet.</span>
          )}
          {isOwner && (
            <div className="mt-2">
              <Link href="/profile/badges" className="text-xs text-emerald-700 hover:underline">
                Learn how to earn badges
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
