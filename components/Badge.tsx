// components/Badge.tsx
"use client";
import Image from "next/image";
import { badgeSrc } from "@/lib/badges";

type Props = {
  tier: number;   // 1..6
  stars: number;  // 1..5
  size?: number;  // px, default 64
  alt?: string;
  className?: string;
};

export default function Badge({ tier, stars, size = 64, alt, className }: Props) {
  const src = badgeSrc(tier, stars);
  return (
    <Image
      src={src}
      alt={alt ?? `Tier ${tier} — ${stars} star${stars > 1 ? "s" : ""}`}
      width={size}
      height={size}
      className={className}
      priority
    />
  );
}
