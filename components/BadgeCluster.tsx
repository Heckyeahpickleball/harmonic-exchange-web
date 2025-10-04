'use client';

import React from 'react';
import Badge from './Badge';

export type ClusterBadge = {
  /** db badge_code (e.g., "give_t1", "recv_t3", "streak_7") */
  code: string;
  /** human label (can be empty) */
  label: string;
  /** track determines caption text */
  track: 'give' | 'receive' | 'streak' | 'milestone';
  /** 1..6 for give/receive; null for streak/milestone */
  tier: number | null;
  /** path under /public (e.g., "/badges/give_rays_t1.png") */
  icon: string;
  /** ISO timestamp (used in key) */
  earned_at: string;
};

type BadgeClusterProps = {
  badges: ClusterBadge[];
  /** badge icon size in px */
  size?: number;
  /** gap between badges in px */
  gap?: number;
  /** show native title tooltip (optional) */
  showTitles?: boolean;
  /** extra classes for the row */
  className?: string;
};

const GIVE_TIERS = [1, 5, 10, 25, 50, 100];
const RECV_TIERS = [1, 5, 10, 25, 50, 100];

function captionFor(b: ClusterBadge): string {
  if (b.track === 'give' && b.tier) {
    const i = Math.max(1, Math.min(6, b.tier)) - 1;
    return `Giver ×${GIVE_TIERS[i]}`;
  }
  if (b.track === 'receive' && b.tier) {
    const i = Math.max(1, Math.min(6, b.tier)) - 1;
    return `Receiver ×${RECV_TIERS[i]}`;
  }
  if (b.track === 'streak') {
    const m = b.code.match(/(\d+)/);
    return `Streak ×${m ? m[1] : '—'}`;
  }
  return b.label || 'Badge';
}

export default function BadgeCluster({
  badges,
  size = 44,
  gap = 10,
  showTitles = false,
  className,
}: BadgeClusterProps) {
  if (!badges?.length) return null;

  return (
    <div
      className={className}
      style={{ display: 'flex', alignItems: 'center', gap }}
      aria-label="earned badges"
    >
      {badges.map((b) => (
        <Badge
          key={`${b.code}-${b.earned_at}`}
          icon={b.icon}
          size={size}
          title={showTitles ? b.label : undefined}
          caption={captionFor(b)}
        />
      ))}
    </div>
  );
}
