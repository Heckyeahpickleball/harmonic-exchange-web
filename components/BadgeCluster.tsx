'use client';

import Link from 'next/link';
import * as React from 'react';
import Badge from './Badge';

export type ProfileBadge = {
  badge_code?: string | null;   // e.g. "give_t2", "recv_t1", "streak_7"
  track?: string | null;        // "give" | "receive" | "streak" | etc.
  tier?: number | null;         // 1..n
  earned_at?: string | null;
  image_url?: string | null;
  label?: string | null;        // e.g. "Giver • Tier 2"
};

export type BadgeClusterProps = {
  badges: ProfileBadge[] | null | undefined;
  size?: number;
  /** page to open when clicking any badge */
  href?: string;                // default: '/profile/badges'
  resolveIcon?: (b: ProfileBadge) => string | null | undefined;
  resolveLabel?: (b: ProfileBadge) => string | null | undefined;
  /** show small text labels under each badge */
  showTitles?: boolean;
  className?: string;
};

function parseFromCode(code: string | null | undefined) {
  // Pull track + tier out of common patterns like "give_t2", "recv_t1", "streak_7"
  if (!code) return { track: null as string | null, tier: null as number | null };
  const lower = code.toLowerCase();

  // Normalize track aliases
  let track: string | null = null;
  if (/\bgiv(e|er)?\b/.test(lower)) track = 'give';
  else if (/\brec(eive|v|vr|eiv)?\b/.test(lower)) track = 'receive';
  else if (/\bstreak\b/.test(lower)) track = 'streak';
  else if (/\bmilestone\b/.test(lower)) track = 'milestone';

  const tierMatch = lower.match(/(?:_t|t)(\d+)|(?:[_-])(\d+)$/);
  const num = tierMatch ? Number(tierMatch[1] ?? tierMatch[2]) : null;

  return { track, tier: Number.isFinite(num) ? num : null };
}

function friendlyTrack(s: string | null | undefined) {
  const t = (s ?? '').toLowerCase();
  if (t === 'give' || t === 'giver') return 'give';
  if (t === 'recv' || t === 'receive' || t === 'receiver') return 'receive';
  if (t === 'streak') return 'streak';
  if (t === 'milestone') return 'milestone';
  return t || null;
}

function cap(s: string) {
  return s ? s.slice(0, 1).toUpperCase() + s.slice(1) : s;
}

/**
 * Compact row of badges.
 * - Only the highest tier per track is shown (T2 replaces T1).
 * - Every badge is a link to the “All Badges & How to Earn” page.
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

    // Normalize each badge (track + tier fallbacks from code)
    const normalized = badges.map((b) => {
      const fromCode = parseFromCode(b.badge_code);
      const track = friendlyTrack(b.track) ?? fromCode.track;
      const tier = (b.tier ?? fromCode.tier ?? 0) as number;
      return { ...b, track, tier } as Required<Pick<ProfileBadge,'track'|'tier'>> & ProfileBadge;
    });

    // Keep only the highest tier for each track
    const byTrack = new Map<string, ProfileBadge & { tier: number; track: string | null }>();
    for (const b of normalized) {
      const key = (b.track ?? 'misc').toLowerCase();
      const prev = byTrack.get(key);
      if (!prev || (b.tier ?? 0) > (prev.tier ?? 0)) {
        byTrack.set(key, b as ProfileBadge & { tier: number; track: string | null });
      }
    }

    // Deterministic order: streak, give, receive, milestone, then alpha
    const order = ['streak', 'give', 'receive', 'milestone'];
    const result = Array.from(byTrack.values()).sort((a, b) => {
      const ai = order.indexOf(String(a.track ?? '').toLowerCase());
      const bi = order.indexOf(String(b.track ?? '').toLowerCase());
      const aRank = ai === -1 ? 999 : ai;
      const bRank = bi === -1 ? 999 : bi;
      if (aRank !== bRank) return aRank - bRank;
      if ((b.tier ?? 0) !== (a.tier ?? 0)) return (b.tier ?? 0) - (a.tier ?? 0); // higher first
      return String(a.badge_code ?? '').localeCompare(String(b.badge_code ?? ''));
    });

    return result;
  }, [badges]);

  if (!display.length) return null;

  return (
    <div className={['flex items-center gap-2 relative z-10', className].join(' ')}>
      {display.map((b) => {
        const label =
          b.label ??
          resolveLabel?.(b) ??
          (b.track ? `${cap(b.track)}${b.tier ? ` • Tier ${b.tier}` : ''}` : b.badge_code ?? 'Badge');

        const icon =
          b.image_url ??
          resolveIcon?.(b) ??
          (b.badge_code ? `/badges/${b.badge_code}.png` : '/badges/placeholder.png');

        return (
          <div key={`${b.track}:${b.badge_code ?? b.tier}`} className="flex flex-col items-center">
            <Link
              href={href}
              className="group inline-flex items-center cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 rounded-full"
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
