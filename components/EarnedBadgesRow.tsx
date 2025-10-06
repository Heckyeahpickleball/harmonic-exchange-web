'use client';

import * as React from 'react';
import Link from 'next/link';
import Badge from '@/components/Badge';

export type ExpandedBadge = {
  badge_code: string;
  label: string | null;
  track: 'give' | 'receive' | 'streak' | 'milestone' | null;
  tier: number | null;
  icon: string | null;        // e.g. "/badges/give_t1.png"
  earned_at: string;          // ISO date/time
};

type Props = {
  badges: ExpandedBadge[] | null | undefined;
  /** pixel size for each badge circle */
  size?: number;
  /** show a small caption under each badge */
  showTitles?: boolean;
  /** where clicking a badge should navigate */
  href?: string; // default changed to '/profile#badges'
  className?: string;
};

/**
 * Compact row of earned badges.
 * - Shows only the three core tracks: give / receive / streak
 * - Only the highest tier per track is shown (T2 replaces T1).
 * - Each badge links to the full badges section on the Profile page.
 */
export default function EarnedBadgesRow({
  badges,
  size = 28,
  showTitles = false,
  href = '/profile#badges',
  className = '',
}: Props) {
  // Nothing to show
  if (!badges?.length) return null;

  // Keep only the three core tracks we want to display
  const CORE_TRACKS: Array<'give' | 'receive' | 'streak'> = ['give', 'receive', 'streak'];
  const filtered = badges.filter(
    (b) => !!b.track && (CORE_TRACKS as string[]).includes(String(b.track))
  );

  // Highest tier per track (within the filtered set)
  const bestByTrack = React.useMemo(() => {
    const map = new Map<string, ExpandedBadge>();
    for (const b of filtered) {
      const key = String(b.track);
      const prev = map.get(key);
      if (!prev || (b.tier ?? 0) > (prev.tier ?? 0)) {
        map.set(key, b);
      }
    }
    return map;
  }, [filtered]);

  // Build the display array in a deterministic order
  const display = React.useMemo(() => {
    return CORE_TRACKS
      .map((t) => bestByTrack.get(t))
      .filter((x): x is ExpandedBadge => !!x);
  }, [bestByTrack]);

  if (!display.length) return null;

  return (
    <div className={['flex items-center gap-2', className].join(' ')}>
      {display.map((b) => {
        const title =
          b.label ??
          (b.track ? `${cap(b.track)}${b.tier ? ` • Tier ${b.tier}` : ''}` : b.badge_code ?? 'Badge');

        const icon =
          b.icon ??
          (b.badge_code ? `/badges/${b.badge_code}.png` : '/badges/placeholder.png');

        // Key is guaranteed unique because we only keep a single (highest) badge per track
        return (
          <div key={String(b.track)} className="flex flex-col items-center">
            <Link
              href={href}
              className="group inline-flex items-center focus:outline-none focus:ring-2 focus:ring-blue-400 rounded-full"
              title={`See all badges — ${title}`}
              aria-label={`See all badges — ${title}`}
            >
              <Badge icon={icon} size={size} title={title} />
            </Link>
            {showTitles && (
              <span className="mt-1 text-[10px] leading-none text-slate-600">{title}</span>
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
