// components/EarnedBadgesRow.tsx
"use client";

import { useEffect, useState } from "react";
import Badge from "@/components/Badge";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type Props = {
  profileId: string;
  size?: number;      // badge size px
  max?: number;       // how many to show (default 8)
  className?: string;
  dense?: boolean;    // tighter spacing
};

type Row = {
  badge_code: string;
  label: string;
  track: "give" | "receive" | "streak" | "milestone" | string;
  tier: number | null;
  icon: string | null;
  earned_at: string;
};

export default function EarnedBadgesRow({ profileId, size = 32, max = 8, className, dense }: Props) {
  const supabase = createClientComponentClient();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    let isCancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("profile_badges_expanded")
        .select("badge_code,label,track,tier,icon,earned_at")
        .eq("profile_id", profileId)
        .order("earned_at", { ascending: false })
        .limit(max);
      if (!isCancelled && !error && data) setRows(data as Row[]);
    })();
    return () => { isCancelled = true; };
  }, [profileId, supabase, max]);

  if (!rows.length) return null;

  return (
    <div className={`flex items-center ${dense ? "gap-1.5" : "gap-2"} ${className ?? ""}`}>
      {rows.map((b) => (
        <Badge
          key={`${b.badge_code}-${b.earned_at}`}
          src={b.icon ?? undefined}
          tier={b.tier ?? undefined}
          track={(b.track as any) ?? undefined}
          size={size}
          alt={b.label}
          className="rounded-full"
        />
      ))}
    </div>
  );
}
