'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import BadgeCluster, { type ClusterBadge } from '@/components/BadgeCluster';

// ——— Minimal types we need (inline; no '@/types/supabase' import) ———
type Profile = {
  id: string;
  full_name?: string | null;
  city?: string | null;
  country?: string | null;
  avatar_url?: string | null;
  created_at?: string | null;
  is_admin?: boolean | null;
};

interface ProfileHeaderProps {
  profile: Profile;
}

export default function ProfileHeader({ profile }: ProfileHeaderProps) {
  const supabase = useMemo(() => createClientComponentClient(), []);
  const [badges, setBadges] = useState<ClusterBadge[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function loadBadges() {
      // Matches the SQL view we created: public.profile_badges_expanded
      const { data, error } = await supabase
        .from('profile_badges_expanded')
        .select('badge_code, label, track, tier, icon, earned_at')
        .eq('profile_id', profile.id)
        .order('earned_at', { ascending: false });

      if (!isMounted) return;

      if (!error && data) {
        // data arrives as rows with the exact fields we select above
        setBadges(
          data.map((r) => ({
            code: r.badge_code,
            label: r.label ?? '',
            track: (r.track as ClusterBadge['track']) ?? 'milestone',
            tier: (r.tier as number | null) ?? null,
            icon: r.icon ?? '/badges/give_rays_t1.png',
            earned_at: r.earned_at,
          }))
        );
      }
    }

    if (profile?.id) loadBadges();
    return () => {
      isMounted = false;
    };
  }, [profile?.id, supabase]);

  const name = profile.full_name ?? 'Member';

  return (
    <header className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Banner */}
      <div className="relative h-40 w-full bg-gradient-to-r from-amber-100 via-emerald-100 to-sky-100">
        <Image
          src="/cover.png"
          alt=""
          fill
          priority
          className="object-cover opacity-80"
        />
      </div>

      {/* Row: avatar + name + actions */}
      <div className="px-4 sm:px-6 -mt-10 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Image
              src={profile.avatar_url || '/avatar.png'}
              alt={name}
              width={64}
              height={64}
              className="rounded-full ring-2 ring-white shadow"
            />
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-slate-900">{name}</h1>

              {/* ➜ Badges to the RIGHT of the name, with captions */}
              {badges.length > 0 && (
                <BadgeCluster
                  badges={badges}
                  size={44}        // bump to 44px; tweak 40–48 to taste
                  gap={12}
                  showTitles={false}
                  className="ml-1"
                />
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/profile/edit"
              className="btn btn-sm bg-white hover:bg-slate-50 border border-slate-300"
            >
              Edit Profile
            </Link>
            <a
              href="/sign-out"
              className="btn btn-sm bg-white hover:bg-slate-50 border border-slate-300"
            >
              Sign out
            </a>
          </div>
        </div>

        {/* Meta row */}
        <div className="mt-1 text-sm text-slate-600">
          {profile.city && profile.country ? (
            <>
              {profile.city}, {profile.country}
            </>
          ) : null}
          {profile.created_at ? (
            <>
              {profile.city && profile.country ? ' • ' : ''}
              Member since {new Date(profile.created_at).toLocaleDateString()}
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
