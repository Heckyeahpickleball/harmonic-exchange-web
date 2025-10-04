'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
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
  /** ISO timestamp (used for sort/dedupe) */
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
  /** link to the “All badges” page */
  hrefAll?: string;
};

const GIVE_TIERS = [1, 5, 10, 25, 50, 100];
const RECV_TIERS = [1, 5, 10, 25, 50, 100];

// Where a click should go (catalog / how-to-earn page)
const BADGE_DEST_DEFAULT = '/badges';

/* ---------------- caption helpers ---------------- */
function captionFor(b: ClusterBadge): string {
  if (b.track === 'give' && b.tier) {
    const i = clampTierIndex(b.tier);
    return `Giver ×${GIVE_TIERS[i]}`;
  }
  if (b.track === 'receive' && b.tier) {
    const i = clampTierIndex(b.tier);
    return `Receiver ×${RECV_TIERS[i]}`;
  }
  if (b.track === 'streak') {
    const m = b.code.match(/(\d+)/);
    return `Streak ×${m ? m[1] : '—'}`;
  }
  return b.label || 'Badge';
}

function clampTierIndex(tier: number) {
  // caps tier to 1..6 and returns zero-based index
  return Math.max(1, Math.min(6, tier)) - 1;
}

/* ---------------- replacement logic ----------------
   - For 'give' and 'receive': keep only the highest tier for that track
   - For 'streak': keep only the highest numeric streak
   - For 'milestone': keep all
---------------------------------------------------- */
function reduceToBest(badges: ClusterBadge[]): ClusterBadge[] {
  const byTrack: Record<string, ClusterBadge[]> = {};
  for (const b of badges) {
    (byTrack[b.track] ||= []).push(b);
  }

  const out: ClusterBadge[] = [];

  // Helper to choose “best” badge from a list in a track
  const takeHighestTier = (list: ClusterBadge[]) => {
    return list.reduce<ClusterBadge | null>((best, cur) => {
      if (!best) return cur;
      const bt = best.tier ?? 0;
      const ct = cur.tier ?? 0;
      if (ct > bt) return cur;
      if (ct === bt) {
        // tie-breaker: latest earned_at wins
        return new Date(cur.earned_at) > new Date(best.earned_at) ? cur : best;
      }
      return best;
    }, null);
  };

  const takeHighestStreak = (list: ClusterBadge[]) => {
    const getNum = (c: ClusterBadge) => {
      if (c.tier && c.tier > 0) return c.tier;
      const m = c.code.match(/(\d+)/);
      return m ? parseInt(m[1], 10) : 0;
    };
    return list.reduce<ClusterBadge | null>((best, cur) => {
      if (!best) return cur;
      const bn = getNum(best);
      const cn = getNum(cur);
      if (cn > bn) return cur;
      if (cn === bn) {
        return new Date(cur.earned_at) > new Date(best.earned_at) ? cur : best;
      }
      return best;
    }, null);
  };

  // give
  if (byTrack.give?.length) {
    const best = takeHighestTier(byTrack.give);
    if (best) out.push(best);
  }
  // receive
  if (byTrack.receive?.length) {
    const best = takeHighestTier(byTrack.receive);
    if (best) out.push(best);
  }
  // streak (only one, highest)
  if (byTrack.streak?.length) {
    const best = takeHighestStreak(byTrack.streak);
    if (best) out.push(best);
  }
  // milestones (keep all)
  if (byTrack.milestone?.length) {
    // newest first
    byTrack.milestone.sort(
      (a, b) => +new Date(b.earned_at) - +new Date(a.earned_at),
    );
    out.push(...byTrack.milestone);
  }

  // Sort visible badges by earned date desc, so latest upgrades bubble up
  out.sort((a, b) => +new Date(b.earned_at) - +new Date(a.earned_at));
  return out;
}

/* ---------------- component ---------------- */
export default function BadgeCluster({
  badges,
  size = 44,
  gap = 10,
  showTitles = false,
  className,
  hrefAll,
}: BadgeClusterProps) {
  const filtered = useMemo(() => reduceToBest(badges || []), [badges]);
  if (!filtered.length) return null;

  const href = hrefAll || BADGE_DEST_DEFAULT;

  return (
    <div
      className={className}
      style={{ display: 'flex', alignItems: 'center', gap }}
      aria-label="earned badges"
    >
      {filtered.map((b) => {
        const title = showTitles ? b.label : undefined;
        const caption = captionFor(b);

        // Keep Badge as-is, just make it clickable.
        const badgeEl = (
          <Badge
            key={`${b.code}-${b.earned_at}`}
            icon={b.icon}
            size={size}
            title={title}
            caption={caption}
          />
        );

        return (
          <Link
            key={`link-${b.code}-${b.earned_at}`}
            href={href}
            aria-label={`View all badges (currently: ${caption})`}
            title="See all badges & how to earn them"
            prefetch
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hx-brand)] rounded-xl"
          >
            {badgeEl}
          </Link>
        );
      })}
    </div>
  );
}
