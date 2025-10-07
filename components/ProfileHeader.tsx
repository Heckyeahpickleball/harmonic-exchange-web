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
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Cover */}
      <div className="h-28 sm:h-32 w-full bg-[url('/cover-default.jpg')] bg-cover bg-center" />

      {/* Header row */}
      <div className="px-4 sm:px-6 -mt-10 pb-4">
        <div className="flex items-end gap-4">
          {/* Avatar */}
          <div className="h-20 w-20 rounded-full border-4 border-white overflow-hidden bg-slate-100 shrink-0">
            {profile?.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={profile?.full_name || 'Avatar'}
                width={80}
                height={80}
                sizes="(max-width: 640px) 80px, 80px"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full grid place-items-center text-slate-400 text-xl">🙂</div>
            )}
          </div>

          {/* Name + meta */}
          <div className="flex-1 min-w-0">
            {/* Top line: name, admin pill, badges inline (desktop/tablet only) */}
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-semibold truncate">
                {profile?.full_name || 'Member'}
              </h1>
              {profile?.is_admin ? (
                <span className="text-xs rounded-full border px-2 py-0.5 bg-emerald-50 border-emerald-200 text-emerald-700">
                  Admin
                </span>
              ) : null}

              {/* Inline badges beside name — keep for sm+ only to preserve desktop look */}
              <div className="ml-2 flex-1 min-w-[140px] hidden sm:block">
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

              {/* Optional helper link for owners */}
              {isOwner && (
                <Link
                  href="/profile/badges"
                  className="hidden sm:inline text-xs text-emerald-700 hover:underline whitespace-nowrap"
                >
                  Learn how to earn
                </Link>
              )}
            </div>

            {/* Meta row */}
            <div className="mt-1 text-sm text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1">
              {(profile?.city || profile?.country) && (
                <span>{[profile.city, profile.country].filter(Boolean).join(', ')}</span>
              )}
              {profile?.created_at && (
                <span className="truncate">
                  • Member since {new Date(profile.created_at).toLocaleDateString()}
                </span>
              )}
            </div>

            {/* Mobile badges: centered, scrollable; shows only on small screens */}
            <div className="sm:hidden mt-3 -mx-2 px-2">
              {loadingBadges ? (
                <span className="text-xs text-slate-500">Loading badges…</span>
              ) : error ? (
                <span className="text-xs text-rose-600">Badges: {error}</span>
              ) : badges && badges.length > 0 ? (
                <div className="flex items-center justify-center gap-4 overflow-x-auto overscroll-contain snap-x snap-mandatory scrollbar-thin">
                  <BadgeCluster badges={badges} size={22} href="/profile/badges" />
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

          {/* Owner actions (desktop only) */}
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
