// components/ProfileHeader.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import BadgeCluster from '@/components/BadgeCluster';
import MessageButton from '@/components/MessageButton';

type Profile = {
  id: string;
  full_name?: string | null;
  city?: string | null;
  country?: string | null;
  avatar_url?: string | null;
  cover_url?: string | null;
  role?: 'user' | 'moderator' | 'admin' | null;
  created_at?: string | null;
};

type ExpandedBadge = {
  profile_id: string | null;
  badge_code: string | null;
  label: string | null;
  track: 'give' | 'receive' | 'streak' | 'milestone' | null;
  tier: number | null;
  earned_at: string | null;
};

interface ProfileHeaderProps {
  profile: Profile;
  isOwner?: boolean;
}

function formatYMD(dateStr?: string | null) {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

export default function ProfileHeader({ profile, isOwner = false }: ProfileHeaderProps) {
  const supabase = useMemo(() => createClientComponentClient(), []);
  const [badges, setBadges] = useState<ExpandedBadge[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('profile_badges_expanded')
          .select('profile_id,badge_code,label,track,tier,earned_at')
          .eq('profile_id', profile.id);
        if (error) throw error;
        if (alive) setBadges((data as ExpandedBadge[]) ?? []);
      } catch {
        if (alive) {
          setBadges([]);
          setError('Badges unavailable');
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [supabase, profile.id]);

  const memberSince = formatYMD(profile.created_at);

  return (
    <section className="overflow-hidden rounded-xl border bg-white">
      {/* Cover */}
      <div className="relative h-40 w-full md:h-56">
        {profile.cover_url ? (
          <Image
            src={profile.cover_url}
            alt="Cover"
            fill
            className="object-cover"
            priority={false}
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-r from-slate-200 to-slate-100" />
        )}
      </div>

      {/* Content */}
      <div className="relative px-4 pb-4 pt-12 md:px-6">
        {/* Avatar */}
        <div className="absolute -top-10 left-4 h-20 w-20 overflow-hidden rounded-full border-4 border-white md:left-6 md:h-24 md:w-24">
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt="Avatar"
              fill
              className="object-cover"
              priority={false}
            />
          ) : (
            <div className="grid h-full w-full place-items-center bg-slate-200 text-slate-500">
              ☺
            </div>
          )}
        </div>

        {/* Header row: avatar (absolute), identity block, actions */}
        <div className="flex items-start justify-between gap-3 md:gap-6">
          {/* Identity, to the right of avatar */}
          <div className="mt-2 md:mt-0 pl-24 md:pl-28 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold md:text-2xl">
                {profile.full_name || 'Unnamed'}
              </h1>
              {!!profile.role && (
                <span className="rounded-full border px-2 py-0.5 text-xs capitalize text-gray-700">
                  {profile.role}
                </span>
              )}
            </div>

            <div className="mt-1 text-sm text-gray-600">
              {profile.city || profile.country ? (
                <span>{[profile.city, profile.country].filter(Boolean).join(', ')}</span>
              ) : (
                <span>—</span>
              )}
              {memberSince && (
                <>
                  <span className="mx-2">•</span>
                  <span>Member since {memberSince}</span>
                </>
              )}
            </div>

            {/* Badges under name (desktop), like your profile */}
            <div className="mt-3 hidden sm:block">
              {error && <span className="text-xs text-amber-700">{error}</span>}
              {badges && badges.length > 0 ? (
                <BadgeCluster
                  badges={badges.slice(0, 5)}
                  size={44}
                  href={`/profile/badges?id=${profile.id}`}
                />
              ) : (
                <span className="text-xs text-slate-500">No badges yet.</span>
              )}
            </div>
          </div>

          {/* Actions (desktop): same spot as Edit/Sign out on owner header */}
          <div className="hidden md:flex items-center gap-2">
            {isOwner ? (
              <>
                <Link
                  href="/profile/edit"
                  className="inline-flex items-center rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
                >
                  Edit Profile
                </Link>
                <Link
                  href="/sign-out"
                  className="inline-flex items-center rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
                >
                  Sign Out
                </Link>
              </>
            ) : (
              <MessageButton toId={profile.id} />
            )}
          </div>
        </div>

        {/* Mobile: badges only (Message button now comes from page layout to avoid duplicates) */}
        <div className="mt-3 sm:hidden pl-24">
          {badges && badges.length > 0 ? (
            <BadgeCluster
              badges={badges.slice(0, 3)}
              size={28}
              href={`/profile/badges?id=${profile.id}`}
            />
          ) : (
            <span className="text-xs text-slate-500">No badges yet.</span>
          )}
        </div>

        {/* Owner mobile actions remain here */}
        {isOwner && (
          <div className="mt-3 sm:hidden pl-24 flex gap-2">
            <Link
              href="/profile/edit"
              className="inline-flex flex-1 items-center justify-center rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
            >
              Edit Profile
            </Link>
            <Link
              href="/sign-out"
              className="inline-flex flex-1 items-center justify-center rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
            >
              Sign Out
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
