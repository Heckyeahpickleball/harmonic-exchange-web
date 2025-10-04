// lib/badgeLevel.ts
export type BadgeLevel = { tier: number; stars: number };

const TIERS = 6;
const STARS_PER_TIER = 5;
const TOTAL_STEPS = TIERS * STARS_PER_TIER; // 30

/**
 * Convert a 0..1 progress (or points) into {tier, stars}.
 * You can swap the `progressFromPoints` with your own logic.
 */
export function tierStarsFromProgress(progress01: number): BadgeLevel {
  const clamped = Math.max(0, Math.min(1, progress01));
  const step = Math.max(0, Math.min(TOTAL_STEPS - 1, Math.floor(clamped * TOTAL_STEPS)));
  const tier = Math.floor(step / STARS_PER_TIER) + 1;       // 1..6
  const stars = (step % STARS_PER_TIER) + 1;                 // 1..5
  return { tier, stars };
}

// Example: linear points→progress mapping
export function progressFromPoints(points: number, maxPoints = 3000) {
  return Math.max(0, Math.min(1, points / maxPoints));
}
