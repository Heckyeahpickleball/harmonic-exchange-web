'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';

export default function NotificationsBell() {
  const [count, setCount] = useState<number>(0);
  const [ready, setReady] = useState(false);

  const loadCount = useCallback(async () => {
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes?.user?.id;
    if (!userId) {
      setCount(0);
      setReady(true);
      return;
    }

    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', userId)
      .is('read_at', null);

    setCount(count ?? 0);
    setReady(true);
  }, []);

  useEffect(() => {
    // initial load
    void loadCount();

    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id;
      if (!userId || cancelled) return;

      channel = supabase
        .channel('notif_bell')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `profile_id=eq.${userId}`,
          },
          () => void loadCount()
        );

      // subscribe without returning the promise
      void channel.subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [loadCount]);

  if (!ready) return <span />;

  return (
    <Link href="/notifications" className="relative inline-block" aria-label="Notifications">
      <span title="Notifications">🔔</span>
      {count > 0 && (
        <span className="absolute -right-2 -top-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-semibold text-white">
          {count}
        </span>
      )}
    </Link>
  );
}
