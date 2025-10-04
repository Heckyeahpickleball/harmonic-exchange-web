// components/Badge.tsx
"use client";
import Image from "next/image";
import { badgeSrc } from "@/lib/badges";

type Props = {
  // Option A: pass a direct icon src from DB, e.g. "/badges/give_rays_t1.png"
  src?: string;
  // Option B: legacy props (kept for compatibility)
  tier?: number;   // 1..6
  stars?: number;  // usually same as tier for your PNG set
  track?: 'give' | 'receive' | 'streak' | 'milestone';
  size?: number;   // px, default 64
  alt?: string;
  className?: string;
};

export default function Badge({
  src,
  tier = 1,
  stars,
  track = "give",
  size = 64,
  alt,
  className
}: Props) {
  const resolvedSrc = src ?? badgeSrc(tier, stars, track);
  return (
    <Image
      src={resolvedSrc}
      alt={alt ?? `Badge${track ? ` • ${track}` : ""}${tier ? ` • T${tier}` : ""}`}
      width={size}
      height={size}
      className={className}
      priority
    />
  );
}
