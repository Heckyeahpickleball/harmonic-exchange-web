'use client';

import Link from 'next/link';
import * as React from 'react';
import Badge from './Badge';

export type ProfileBadge = {
  badge_code?: string | null;   // e.g. "give_t2", "recv_t1", "streak_7"
  track: string;                // e.g. "give" | "receive" | "streak"
  tier: number;                 // 1..n
  earned_at?: string | null;
  image_url?: string | null;    // optional: pre-resolved URL
  label?: string | null;        // optional: human label like "Giver • Tier 2"
};

export type BadgeClusterProps = {
  badges: ProfileBadge[] | null | undefined;
  /** px size for each badge circle */
  size?: number;
  /** where clicking a badge should navigate */
  href?: string; // default: '/debug/gamification'
  /** map a badge to an icon URL (optional) */
  resolveIcon?: (b: ProfileBadge) => string | null | undefined;
  /** map a badge to a caption/label (optional) */
  resolveLabel?: (b: ProfileBadge) => string | null | undefined;
  className?: string;
};

/**
 * Show the user's badges as a compact row.
 * - Click navigates to the full “All Badges & How to Earn Them” page.
 * - Only the highest tier per track is shown (T2 replaces T1, etc.)
 */
export default function BadgeCluster({
  badges,
  size = 40,
  href = '/debug/gamification',
  resolveIcon,
  resolveLabel,
  className = '',
}: BadgeClusterProps) {
  const display = React.useMemo(() => {
    if (!badges?.length) return [];

    // keep only the highest tier for each track
    const byTrack = new Map<string, ProfileBadge>();
    for (const b of badges) {
      const key = String(b.track ?? '').toLowerCase();
      const prev = byTrack.get(key);
      if (!prev || (b.tier ?? 0) > (prev.tier ?? 0)) byTrack.set(key, b);
    }

    // order by a nice deterministic rule (streak, give, receive; then alpha)
    const order = ['streak', 'give', 'receive'];
    const result = Array.from(byTrack.values()).sort((a, b) => {
      const ai = order.indexOf(String(a.track).toLowerCase());
      const bi = order.indexOf(String(b.track).toLowerCase());
      const aRank = ai === -1 ? 999 : ai;
      const bRank = bi === -1 ? 999 : bi;
      if (aRank !== bRank) return aRank - bRank;
      if ((b.tier ?? 0) !== (a.tier ?? 0)) return (b.tier ?? 0) - (a.tier ?? 0); // higher tier first
      return String(a.badge_code ?? '').localeCompare(String(b.badge_code ?? ''));
    });

    return result;
  }, [badges]);

  if (!display.length) return null;

  return (
    <div className={['flex items-center gap-2', className].join(' ')}>
      {display.map((b) => {
        const label =
          b.label ??
          resolveLabel?.(b) ??
          // reasonable fallback labels
          (b.track
            ? `${cap(b.track)}${b.tier ? ` • Tier ${b.tier}` : ''}`
            : b.badge_code ?? 'Badge');

        const icon =
          b.image_url ??
          resolveIcon?.(b) ??
          // default guess: you keep your assets in /public/badges/<code>.png
          (b.badge_code ? `/badges/${b.badge_code}.png` : '/badges/placeholder.png');

        return (
          <Link
            key={`${b.track}:${b.badge_code ?? b.tier}`}
            href={href}
            className="group inline-flex items-center"
            title={`See all badges — ${label}`}
            aria-label={`See all badges — ${label}`}
          >
            <Badge icon={icon} size={size} title={label} />
          </Link>
        );
      })}
    </div>
  );
}

function cap(s: string) {
  return s ? s.slice(0, 1).toUpperCase() + s.slice(1) : s;
}
