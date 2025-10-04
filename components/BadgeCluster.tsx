'use client';

import Link from 'next/link';
import * as React from 'react';
import Badge from './Badge';

/**
 * The cluster accepts a minimal, tolerant shape so both your
 * ProfileBadge rows and ExpandedBadge rows can be rendered.
 * (This fixes the "ExpandedBadge[] is not assignable to ProfileBadge[]" error.)
 */
export type ClusterBadge = {
  badge_code?: string | null;     // e.g. "give_t2", "recv_t1"
  track?: string | null;          // "give" | "receive" | "streak" | etc.
  tier?: number | null;           // 1..n
  earned_at?: string | null;
  image_url?: string | null;      // optional pre-resolved URL
  label?: string | null;          // human label like "Giver • Tier 2"
  icon?: string | null;           // some sources call it "icon"
};

export type BadgeClusterProps = {
  badges: ClusterBadge[] | null | undefined;
  /** px size for each badge circle */
  size?: number;
  /** where clicking a badge should navigate */
  href?: string; // default: '/profile/badges'
  /** map a badge to an icon URL (optional) */
  resolveIcon?: (b: ClusterBadge) => string | null | undefined;
  /** map a badge to a caption/label (optional) */
  resolveLabel?: (b: ClusterBadge) => string | null | undefined;
  /** show small text labels under each badge */
  showTitles?: boolean;
  className?: string;
};

/**
 * Compact row of badges.
 * - Only the highest tier per track is shown (T2 replaces T1).
 * - Every badge is a link to your “All Badges & How to Earn” page.
 */
export default function BadgeCluster({
  badges,
  size = 40,
  href = '/profile/badges',
  resolveIcon,
  resolveLabel,
  showTitles = false,
  className = '',
}: BadgeClusterProps) {
  const display = React.useMemo(() => {
    if (!badges?.length) return [];

    // Keep only the highest tier for each track
    const byTrack = new Map<string, ClusterBadge>();
    for (const b of badges) {
      const key = String(b.track ?? '').toLowerCase();
      if (!key) continue; // skip items with no track
      const prev = byTrack.get(key);
      const curTier = b.tier ?? 0;
      const prevTier = prev?.tier ?? 0;
      if (!prev || curTier > prevTier) byTrack.set(key, b);
    }

    // deterministic order: streak, give, receive, then alpha
    const order = ['streak', 'give', 'receive'];
    const result = Array.from(byTrack.values()).sort((a, b) => {
      const ai = order.indexOf(String(a.track ?? '').toLowerCase());
      const bi = order.indexOf(String(b.track ?? '').toLowerCase());
      const aRank = ai === -1 ? 999 : ai;
      const bRank = bi === -1 ? 999 : bi;
      if (aRank !== bRank) return aRank - bRank;

      // higher tier first
      const at = a.tier ?? 0;
      const bt = b.tier ?? 0;
      if (bt !== at) return bt - at;

      // stable fallback by code
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
          (b.track ? `${cap(String(b.track))}${b.tier ? ` • Tier ${b.tier}` : ''}` : b.badge_code ?? 'Badge');

        const icon =
          b.image_url ??
          b.icon ??
          resolveIcon?.(b) ??
          (b.badge_code ? `/badges/${b.badge_code}.png` : '/badges/placeholder.png');

        return (
          <div key={`${b.track}:${b.badge_code ?? b.tier}`} className="flex flex-col items-center">
            <Link
              href={href}
              className="group inline-flex items-center focus:outline-none focus:ring-2 focus:ring-blue-400 rounded-full"
              title={`See all badges — ${label}`}
              aria-label={`See all badges — ${label}`}
            >
              <Badge icon={icon} size={size} title={label} />
            </Link>
            {showTitles && (
              <span className="mt-1 text-[10px] leading-none text-slate-600">{label}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function cap(s: string) {
  return s ? s.slice(0, 1).toUpperCase() + s.slice(1) : s;
}
