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
  href?: string; // default: '/profile/badges'
  className?: string;
};

/**
 * Compact row of earned badges.
 * - Only the highest tier per track is shown (T2 replaces T1).
 * - Each badge is a link to the full badges page.
 */
export default function EarnedBadgesRow({
  badges,
  size = 28,
  showTitles = false,
  href = '/profile/badges',
  className = '',
}: Props) {
  if (!badges?.length) return null;

  // Highest tier per track
  const display = React.useMemo(() => {
    const byTrack = new Map<string, ExpandedBadge>();
    for (const b of badges) {
      const key = String(b.track ?? '').toLowerCase();
      const prev = byTrack.get(key);
      if (!prev || (b.tier ?? 0) > (prev.tier ?? 0)) byTrack.set(key, b);
    }
    // Nice deterministic order
    const order = ['streak', 'give', 'receive', 'milestone'];
    return Array.from(byTrack.values()).sort((a, b) => {
      const ai = order.indexOf(String(a.track).toLowerCase());
      const bi = order.indexOf(String(b.track).toLowerCase());
      const ra = ai === -1 ? 999 : ai;
      const rb = bi === -1 ? 999 : bi;
      if (ra !== rb) return ra - rb;
      if ((b.tier ?? 0) !== (a.tier ?? 0)) return (b.tier ?? 0) - (a.tier ?? 0);
      return String(a.badge_code ?? '').localeCompare(String(b.badge_code ?? ''));
    });
  }, [badges]);

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

        return (
          <div key={`${b.track}:${b.badge_code ?? b.tier}`} className="flex flex-col items-center">
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
