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

// Build a filename based on track + tier that matches /public/badges
function guessIconPath(b: ClusterBadge): string | undefined {
  const track = (b.track || '').toLowerCase();
  const tier = clampTier(b.tier);
  if (track === 'give') return `/badges/give_rays_t${tier}.png`;
  if (track === 'receive') return `/badges/receive_bowl_t${tier}.png`;
  if (track === 'streak') return '/badges/streak_wave.png';
  return undefined;
}

// Final safety net
const ULTIMATE_FALLBACK = '/badges/streak_wave.png';

// Clamp tiers to 1..6
function clampTier(n: number | null | undefined): number {
  const t = Number(n || 1);
  return Math.max(1, Math.min(6, isFinite(t) ? t : 1));
}

// New naming across tiers
function tierTitle(trackRaw: string | null | undefined, tierRaw: number | null | undefined): string {
  const track = (trackRaw || '').toLowerCase();
  const tier = clampTier(tierRaw);

  if (track === 'streak') return 'Harmonic Streak';

  if (track === 'give') {
    switch (tier) {
      case 1: return 'New Giver';
      case 2: return 'Kindling Giver';
      case 3: return 'Flow Giver';
      case 4: return 'Resonant Giver';
      case 5: return 'Harmonic Giver';
      default: return 'Luminary Giver';
    }
  }

  if (track === 'receive') {
    switch (tier) {
      case 1: return 'New Receiver';
      case 2: return 'Open Receiver';
      case 3: return 'Flow Receiver';
      case 4: return 'Resonant Receiver';
      case 5: return 'Harmonic Receiver';
      default: return 'Luminary Receiver';
    }
  }

  // fallback for unknown/legacy rows
  return 'Harmonic Badge';
}

export default function BadgeCluster({
  badges,
  size = 48,
  href = '/profile#badges',
  resolveIcon,
  resolveLabel,
  showTitles = true,
  className = '',
  itemWidth = 112,
}: BadgeClusterProps) {
  // 1) keep only highest tier per track (no placeholders)
  const display = React.useMemo(() => {
    const byTrack = new Map<string, ClusterBadge>();
    for (const b of badges ?? []) {
      const key = String(b.track ?? '').toLowerCase();
      if (!key) continue;
      const curTier = b.tier ?? 0;
      const prevTier = byTrack.get(key)?.tier ?? -1;
      if (!byTrack.has(key) || curTier > prevTier) byTrack.set(key, b);
    }
    // stable order
    return ORDER.map((t) => byTrack.get(t)).filter(Boolean) as ClusterBadge[];
  }, [badges]);

  if (display.length === 0) return null;

  return (
    <div className={['flex flex-nowrap items-start gap-6 overflow-x-auto md:overflow-visible', className].join(' ')}>
      {display.map((b) => {
        // Prefer resolver if provided; otherwise use our new canonical naming.
        const computedTitle = tierTitle(b.track, b.tier);
        const label =
          resolveLabel?.(b) ??
          computedTitle;

        // Prefer “known good” sources first to avoid broken images:
        // image_url -> legacy icon -> resolver -> by track/tier -> by code -> ultimate fallback
        const derivedFromCode = b.badge_code ? `/badges/${b.badge_code}.png` : undefined;
        const icon =
          b.image_url ||
          b.icon ||
          resolveIcon?.(b) ||
          guessIconPath(b) ||
          derivedFromCode ||
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
