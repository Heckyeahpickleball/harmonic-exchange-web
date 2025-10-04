'use client';

import * as React from 'react';
import Image from 'next/image';

export type ClusterBadge = {
  badge_code: string;
  label: string | null;
  track: 'give' | 'receive' | 'streak' | 'milestone' | null;
  tier: number | null;
  icon: string | null;        // e.g. "/badges/give_rays_t1.png"
  earned_at?: string | null;
};

type Props = {
  badges: ClusterBadge[];
  size?: number;   // px, default 28
  gap?: number;    // px, default 8
  showTitles?: boolean;
};

/**
 * Renders a simple row of badge icons with optional titles.
 * Assumes the icon path is a public path (under /public).
 */
export default function BadgeCluster({ badges, size = 28, gap = 8, showTitles = false }: Props) {
  if (!badges || badges.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center" style={{ gap }}>
      {badges.map((b) => {
        const src = b.icon || '/badges/generic_badge.png';
        const title =
          b.label
            ? `${b.label}${b.tier ? ` (T${b.tier})` : ''}`
            : b.tier
            ? `Tier ${b.tier}`
            : 'Badge';

        return (
          <div
            key={`${b.badge_code}-${b.earned_at ?? ''}`}
            className="relative"
            title={showTitles ? title : undefined}
            aria-label={showTitles ? title : undefined}
          >
            <Image
              src={src}
              alt={b.label || 'badge'}
              width={size}
              height={size}
              className="rounded-full shadow-sm border border-slate-200 object-contain bg-white"
            />
          </div>
        );
      })}
    </div>
  );
}
