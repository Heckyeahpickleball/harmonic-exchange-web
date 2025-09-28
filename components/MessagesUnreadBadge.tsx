// components/MessagesUnreadBadge.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

/**
 * Tiny unread-count pill for the Messages nav link.
 * - Counts only unread "message_received" rows for the signed-in user
 * - Refetches on realtime INSERT/UPDATE affecting your notifications
 */
export default function MessagesUnreadBadge() {
  const [uid, setUid] = useState<string | null>(null);
  const [count, setCount] = useState<number>(0);
  const fetching = useRef(false);

  const show = useMemo(() => (count ?? 0) > 0, [count]);

  async function fetchCount(userId: string) {
    if (fetching.current) return;
    fetching.current = true;
    try {
      const { count: c } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', userId)
        .eq('type', 'message_received')
        .is('read_at', null);
      setCount(c ?? 0);
    } finally {
      fetching.current = false;
    }
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const me = data?.user?.id ?? null;
      setUid(me);
      if (!me) return;

      // initial
      await fetchCount(me);

      // realtime: any INSERT/UPDATE to my notifications -> refetch
      const ch = supabase
        .channel('realtime:messages-unread')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notifications', filter: `profile_id=eq.${me}` },
          () => { void fetchCount(me); }
        )
        .subscribe();

      return () => { supabase.removeChannel(ch); };
    })();
  }, []);

  if (!uid || !show) return null;

  return (
    <span
      aria-label={`${count} unread messages`}
      className="ml-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-amber-500 px-1 text-[11px] font-bold text-white"
    >
      {count}
    </span>
  );
}
