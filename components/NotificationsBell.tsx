'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function NotificationsBell() {
  const [uid, setUid] = useState<string | null>(null);
  const [unread, setUnread] = useState<number>(0);

  // Initial load
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const u = auth.user?.id ?? null;
      setUid(u);
      if (!u) return;

      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', u)
        .is('read_at', null);
      setUnread(count ?? 0);
    })();
  }, []);

  // Realtime
  useEffect(() => {
    if (!uid) return;
    const channel = supabase
      .channel('notif-bell')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `profile_id=eq.${uid}` },
        () => setUnread((n) => n + 1)
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [uid]);

  if (!uid) return null;

  return (
    <Link href="/notifications" className="relative inline-flex items-center">
      <span aria-hidden>🔔</span>
      {unread > 0 && (
        <span className="absolute -right-2 -top-2 rounded-full bg-red-600 px-1.5 text-[10px] font-semibold text-white">
          {unread}
        </span>
      )}
    </Link>
  );
}
