// lib/badges.ts

export type BadgeTrack = 'give' | 'receive' | 'streak' | 'milestone';

// Public PNGs you placed under /public/badges/*.png
// Default “builder” in case some UI still calls badgeSrc(tier)
export function badgeSrc(tier: number, _stars?: number, track: BadgeTrack = 'give') {
  const safeTier = Math.max(1, Math.min(6, tier));
  switch (track) {
    case 'receive':
      return `/badges/receive_bowl_t${safeTier}.png`;
    case 'streak':
      return `/badges/streak_wave.png`;
    default:
      return `/badges/give_rays_t${safeTier}.png`;
  }
}

// Where we’ll read thresholds in the app (and show progress if you want later)
export const BADGE_THRESHOLDS = {
  give:     [1, 5, 10, 25, 50, 100],
  receive:  [1, 5, 10, 25, 50, 100],
  // add more tracks later if we introduce them
};
