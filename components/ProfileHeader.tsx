'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '../types/supabase';
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
  icon: string | null;            // e.g. "/badges/give_rays_t1.png"
  earned_at: string;              // timestamp
};

interface ProfileHeaderProps {
  profile: Profile;
  isOwner?: boolean;
}

export default function ProfileHeader({ profile, isOwner = false }: ProfileHeaderProps) {
  const supabase = useMemo(() => createClientComponentClient<Database>(), []);
  const [badges, setBadges] = useState<ExpandedBadge[] | null>(null);
  const [loadingBadges, setLoadingBadges] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // ---- Fetch badges for this profile
  useEffect(() => {
    let isMounted = true;

    async function loadBadges() {
      setLoadingBadges(true);
      setError(null);
      const { data, error } = await supabase
        .from('profile_badges_expanded')
        .select('badge_code,label,track,tier,icon,earned_at')
        .eq('profile_id', profile.id)
        .order('earned_at', { ascending: false });

      if (!isMounted) return;
      if (error) {
        setError(error.message);
        setBadges([]);
      } else {
        // Normalize icon paths (fallback to a generic)
        const normalized = (data ?? []).map((b) => ({
          ...b,
          icon: b.icon ?? '/badges/generic_badge.png',
        })) as ExpandedBadge[];
        setBadges(normalized);
      }
      setLoadingBadges(false);
    }

    if (profile?.id) loadBadges();
    return () => {
      isMounted = false;
    };
  }, [supabase, profile?.id]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Cover */}
      <div className="h-32 w-full bg-[url('/cover-default.jpg')] bg-cover bg-center" />

      {/* Header row */}
      <div className="px-4 sm:px-6 -mt-10 pb-4">
        <div className="flex items-end gap-4">
          <div className="h-20 w-20 rounded-full border-4 border-white overflow-hidden bg-slate-100 shrink-0">
            {profile?.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={profile?.full_name || 'Avatar'}
                width={80}
                height={80}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full grid place-items-center text-slate-400 text-xl">🙂</div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-semibold truncate">
                {profile?.full_name || 'Member'}
              </h1>
              {profile?.is_admin ? (
                <span className="text-xs rounded-full border px-2 py-0.5 bg-emerald-50 border-emerald-200 text-emerald-700">
                  Admin
                </span>
              ) : null}
            </div>

            <div className="mt-1 text-sm text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1">
              {(profile?.city || profile?.country) && (
                <span>
                  {[profile.city, profile.country].filter(Boolean).join(', ')}
                </span>
              )}
              {profile?.created_at && (
                <span className="truncate">
                  • Member since {new Date(profile.created_at).toLocaleDateString()}
                </span>
              )}
            </div>

            {/* Badge Cluster */}
            <div className="mt-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-slate-700">Badges</h2>
                {isOwner && (
                  <Link
                    href="/profile/badges"
                    className="text-xs text-emerald-700 hover:underline"
                  >
                    Learn how to earn
                  </Link>
                )}
              </div>

              <div className="mt-2">
                {loadingBadges ? (
                  <div className="text-sm text-slate-500">Loading badges…</div>
                ) : error ? (
                  <div className="text-sm text-rose-600">Couldn’t load badges: {error}</div>
                ) : badges && badges.length > 0 ? (
                  <BadgeCluster
                    badges={badges}
                    size={28}
                    // tooltips on hover
                    showTitles
                  />
                ) : (
                  <div className="text-sm text-slate-500">No badges yet.</div>
                )}
              </div>
            </div>
          </div>

          {/* Owner actions */}
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
