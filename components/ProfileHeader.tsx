'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import BadgeCluster, { type ClusterBadge } from '@/components/BadgeCluster';

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

/**
 * ProfileHeader
 * - Shows cover, avatar, name/labels
 * - Renders earned badges under the name using <BadgeCluster />
 */
export default function ProfileHeader({ profile }: ProfileHeaderProps) {
  const supabase = useMemo(() => createClientComponentClient(), []);
  const [badges, setBadges] = useState<ClusterBadge[]>([]);
  const [loadingBadges, setLoadingBadges] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    const loadBadges = async () => {
      if (!profile?.id) return;
      setLoadingBadges(true);

      // Read from the expanded, UI-friendly view
      const { data, error } = await supabase
        .from('profile_badges_expanded')
        .select('badge_code,label,track,tier,icon,earned_at')
        .eq('profile_id', profile.id)
        .order('earned_at', { ascending: false });

      if (!isMounted) return;

      if (error) {
        // Fail silently in UI, but log for devs
        console.error('Badges load error:', error);
        setBadges([]);
      } else {
        // This shape matches ClusterBadge (badge_code, label, track, tier, icon, earned_at)
        setBadges((data ?? []) as ClusterBadge[]);
      }
      setLoadingBadges(false);
    };

    loadBadges();
    return () => {
      isMounted = false;
    };
  }, [supabase, profile?.id]);

  return (
    <div className="w-full">
      {/* Cover */}
      <div className="relative w-full h-48 rounded-t-2xl overflow-hidden bg-gradient-to-r from-amber-200 to-teal-700">
        <Image
          fill
          src="/headers/harmonic-cover.jpg"
          alt="Profile cover"
          className="object-cover"
          priority
        />
      </div>

      {/* Header row */}
      <div className="bg-white rounded-b-2xl shadow-sm px-5 pb-5">
        <div className="flex items-center -mt-8 gap-4">
          {/* Avatar */}
          <div className="relative h-16 w-16 rounded-full ring-4 ring-white overflow-hidden bg-slate-100">
            <Image
              src={profile?.avatar_url || '/avatars/default.png'}
              alt={profile?.full_name || 'Profile avatar'}
              fill
              className="object-cover"
            />
          </div>

          {/* Name + meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold leading-tight">
                {profile?.full_name || 'Member'}
              </h1>
              {profile?.is_admin ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-white">Admin</span>
              ) : null}
            </div>

            {/* Location + member since */}
            <div className="text-sm text-slate-600 mt-0.5">
              {profile?.city && profile?.country ? (
                <>
                  {profile.city}, {profile.country}
                </>
              ) : profile?.country ? (
                <>{profile.country}</>
              ) : null}
              {profile?.created_at ? (
                <>
                  {profile?.city || profile?.country ? ' • ' : ''}
                  Member since {new Date(profile.created_at).toLocaleDateString()}
                </>
              ) : null}
            </div>

            {/* Badges row — sized up */}
            <div className="mt-2">
              {loadingBadges ? (
                <div className="h-8 w-32 rounded bg-slate-100 animate-pulse" />
              ) : badges && badges.length > 0 ? (
                <BadgeCluster
                  badges={badges}
                  size={42}     {/* ⬅️ bumped up (try 40–44 if you want) */}
                  gap={10}
                  showTitles={false}
                />
              ) : null}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Link
              href="/profile/edit"
              className="px-3 py-1.5 rounded-md border text-sm hover:bg-slate-50"
            >
              Edit Profile
            </Link>
            <Link
              href="/sign-out"
              className="px-3 py-1.5 rounded-md border text-sm hover:bg-slate-50"
            >
              Sign Out
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
