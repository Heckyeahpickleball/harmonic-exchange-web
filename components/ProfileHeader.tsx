// components/ProfileHeader.tsx
"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import EarnedBadgesRow from "@/components/EarnedBadgesRow";

type Profile = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  // ...whatever else you already had
};

export default function ProfileHeader({ profileId }: { profileId: string }) {
  const supabase = createClientComponentClient();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let isCancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .eq("id", profileId)
        .maybeSingle();
      if (!isCancelled) setProfile(data as Profile);
    })();
    return () => { isCancelled = true; };
  }, [profileId, supabase]);

  if (!profile) return null;

  return (
    <header className="rounded-2xl border border-gray-200 bg-white p-4 md:p-6 shadow-sm">
      <div className="flex items-center gap-4">
        {/* your avatar / name block, unchanged if you already had it */}
        <div className="flex flex-col">
          <h1 className="text-xl md:text-2xl font-semibold">{profile.display_name ?? "Member"}</h1>
          {profile.username ? (
            <span className="text-sm text-gray-500">@{profile.username}</span>
          ) : null}
          {/* NEW: earned badges (latest 8) */}
          <div className="mt-3">
            <EarnedBadgesRow profileId={profile.id} />
          </div>
        </div>
      </div>
    </header>
  );
}
