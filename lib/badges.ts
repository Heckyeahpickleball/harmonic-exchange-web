// lib/badges.ts
export function badgeSrc(tier: number, stars: number) {
  const t = Math.min(Math.max(tier, 1), 6);
  const s = Math.min(Math.max(stars, 1), 5);
  return `/badges/t${t}_s${s}.png`;
}
