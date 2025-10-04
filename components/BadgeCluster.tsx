// components/BadgeCluster.tsx
"use client";
import Badge from "@/components/Badge";

type Props = {
  tier: number;     // 1..6
  stars: number;    // 1..5
  label?: string;   // optional subtitle like "Level 34"
  size?: number;    // px
  className?: string;
};

export default function BadgeCluster({ tier, stars, label, size = 64, className }: Props) {
  return (
    <div className={`flex items-center gap-3 ${className ?? ""}`}>
      <Badge tier={tier} stars={stars} size={size} />
      <div className="flex flex-col leading-tight">
        <span className="font-medium">{`Tier ${tier}`}</span>
        <span className="text-xs text-gray-500">{`${stars} star${stars > 1 ? "s" : ""}${label ? ` • ${label}` : ""}`}</span>
      </div>
    </div>
  );
}
