'use client';

import Link from 'next/link';
import * as React from 'react';
import Badge from './Badge';

export type ClusterBadge = {
  badge_code?: string | null;
  track?: string | null;
  tier?: number | null;
  earned_at?: string | null;
  image_url?: string | null; // preferred when present
  label?: string | null;
  icon?: string | null;      // legacy field some rows may have
};

export type BadgeClusterProps = {
  badges: ClusterBadge[] | null | undefined;
  size?: number;
  href?: string;
  resolveIcon?: (b: ClusterBadge) => string | null | undefined;
  resolveLabel?: (b: ClusterBadge) => string | null | undefined;
  showTitles?: boolean;
  className?: string;
  itemWidth?: number;
};

const ORDER: Array<'streak' | 'give' | 'receive'> = ['streak', 'give', 'receive'];

const FALLBACK_LABEL: Record<string, string> = {
  streak: 'Keep the Flow',
  give: 'First Gift',
  receive: 'First Receiving',
};

// Build a filename based on track + tier that matches your /public/badges folder
function guessIconPath(b: ClusterBadge): string | undefined {
  const track = (b.track || '').toLowerCase();
  const tier = Math.max(1, Math.min(6, Number(b.tier) || 1)); // clamp 1..6
  if (track === 'give') return `/badges/give_rays_t${tier}.png`;
  if (track === 'receive') return `/badges/receive_bowl_t${tier}.png`;
  if (track === 'streak') return '/badges/streak_wave.png';
  return undefined;
}

// Final fallback if everything else is missing
const ULTIMATE_FALLBACK = '/badges/streak_wave.png';

export default function BadgeCluster({
  badges,
  size = 48,
  href = '/profile/badges',
  resolveIcon,
  resolveLabel,
  showTitles = true,
  className = '',
  itemWidth = 112,
}: BadgeClusterProps) {
  // keep highest-tier badge per track
  const display = React.useMemo(() => {
    const byTrack = new Map<string, ClusterBadge>();
    for (const b of badges ?? []) {
      const key = String(b.track ?? '').toLowerCase();
      if (!key) continue;
      const curTier = b.tier ?? 0;
      const prevTier = byTrack.get(key)?.tier ?? -1;
      if (!byTrack.has(key) || curTier > prevTier) byTrack.set(key, b);
    }
    // ensure we always render 3 slots (with placeholders where needed)
    return ORDER.map((trk) => {
      const existing = byTrack.get(trk);
      if (existing) return existing;
      return {
        track: trk,
        tier: 1,
        badge_code: `${trk}_locked`,
        label: FALLBACK_LABEL[trk],
        image_url: guessIconPath({ track: trk, tier: 1 }) ?? ULTIMATE_FALLBACK,
        earned_at: null,
      } as ClusterBadge;
    });
  }, [badges]);

  if (!display.length) return null;

  return (
    <div className={['flex flex-nowrap items-start gap-6 overflow-x-auto md:overflow-visible', className].join(' ')}>
      {display.map((b) => {
        const label =
          b.label ??
          resolveLabel?.(b) ??
          (b.track ? `${cap(String(b.track))}${b.tier ? ` • Tier ${b.tier}` : ''}` : b.badge_code ?? 'Badge');

        // priority: explicit image -> legacy icon -> resolver -> derived by code -> guessed by track/tier -> final fallback
        const derivedFromCode = b.badge_code ? `/badges/${b.badge_code}.png` : undefined;
        const icon =
          b.image_url ||
          b.icon ||
          resolveIcon?.(b) ||
          derivedFromCode ||
          guessIconPath(b) ||
          ULTIMATE_FALLBACK;

        return (
          <div
            key={`${b.track}:${b.badge_code ?? b.tier}`}
            className="flex-none flex flex-col items-center"
            style={{ width: itemWidth }}
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
