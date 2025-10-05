// components/BadgeCluster.tsx
'use client';

import Link from 'next/link';
import * as React from 'react';
import Badge from './Badge';

/** Tolerant shape so different badge sources can render here */
export type ClusterBadge = {
  badge_code?: string | null;
  track?: string | null;
  tier?: number | null;
  earned_at?: string | null;
  image_url?: string | null;
  label?: string | null;
  icon?: string | null;
};

export type BadgeClusterProps = {
  badges: ClusterBadge[] | null | undefined;
  /** px size of each circular badge */
  size?: number;
  /** destination when a badge is clicked */
  href?: string; // default: '/profile/badges'
  /** optional mappers */
  resolveIcon?: (b: ClusterBadge) => string | null | undefined;
  resolveLabel?: (b: ClusterBadge) => string | null | undefined;
  /** captions on/off (defaults to ON) */
  showTitles?: boolean;
  /** extra classes for the whole row */
  className?: string;
  /** fixed width (px) reserved for each badge+caption so spacing is even */
  itemWidth?: number; // e.g. 112
};

export default function BadgeCluster({
  badges,
  size = 48,
  href = '/profile/badges',
  resolveIcon,
  resolveLabel,
  showTitles = true,
  className = '',
  itemWidth = 112, // <- consistent spacing
}: BadgeClusterProps) {
  const display = React.useMemo(() => {
    if (!badges?.length) return [];

    // keep only highest tier per track
    const byTrack = new Map<string, ClusterBadge>();
    for (const b of badges) {
      const key = String(b.track ?? '').toLowerCase();
      if (!key) continue;
      const curTier = b.tier ?? 0;
      const prevTier = byTrack.get(key)?.tier ?? 0;
      if (!byTrack.has(key) || curTier > prevTier) byTrack.set(key, b);
    }

    // deterministic order
    const order = ['streak', 'give', 'receive'];
    return Array.from(byTrack.values()).sort((a, b) => {
      const ai = order.indexOf(String(a.track ?? '').toLowerCase());
      const bi = order.indexOf(String(b.track ?? '').toLowerCase());
      const ar = ai === -1 ? 999 : ai;
      const br = bi === -1 ? 999 : bi;
      if (ar !== br) return ar - br;
      const at = a.tier ?? 0;
      const bt = b.tier ?? 0;
      if (bt !== at) return bt - at;
      return String(a.badge_code ?? '').localeCompare(String(b.badge_code ?? ''));
    });
  }, [badges]);

  if (!display.length) return null;

  return (
    <div
      className={[
        // single row, never wrap; allow scroll on narrow screens
        'flex flex-nowrap items-start gap-6 overflow-x-auto md:overflow-visible',
        className,
      ].join(' ')}
    >
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
          <div
            key={`${b.track}:${b.badge_code ?? b.tier}`}
            className="flex-none flex flex-col items-center"
            style={{ width: itemWidth }} // <- keeps spacing even regardless of caption length
          >
            <Link
              href={href}
              className="group inline-flex items-center focus:outline-none focus:ring-2 focus:ring-blue-400 rounded-full"
              title={`See all badges — ${label}`}
              aria-label={`See all badges — ${label}`}
            >
              <Badge icon={icon} size={size} title={label} />
            </Link>
            {showTitles && (
              <span className="mt-1 text-[10px] leading-tight text-slate-600 text-center line-clamp-2">
                {label}
              </span>
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
