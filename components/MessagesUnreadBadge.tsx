'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

/** Small bubble that shows how many unread chat messages you have. */
export default function MessagesUnreadBadge() {
  const [uid, setUid] = useState<string | null>(null);
  const [count, setCount] = useState(0);

  // fetch auth uid
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUid(data?.user?.id ?? null);
    })();
  }, []);

  // helper to (re)count unread
  async function refresh() {
    if (!uid) return;
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', uid)
      .eq('type', 'message_received')
      .is('read_at', null);
    setCount(count ?? 0);
  }

  // initial + realtime
  useEffect(() => {
    if (!uid) return;
    void refresh();

    const chIns = supabase
      .channel('realtime:msg_unread:ins')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `profile_id=eq.${uid}` },
        (payload) => {
          const n = payload.new as any;
          if (n.type === 'message_received' && !n.read_at) {
            setCount((c) => c + 1);
          }
        }
      )
      .subscribe();

    const chUpd = supabase
      .channel('realtime:msg_unread:upd')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `profile_id=eq.${uid}` },
        (payload) => {
          const n = payload.new as any;
          // if a message_received gets marked read, decrement safely (don’t go below 0)
          if (n.type === 'message_received' && n.read_at) {
            setCount((c) => Math.max(0, c - 1));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(chIns);
      supabase.removeChannel(chUpd);
    };
  }, [uid]);

  const show = useMemo(() => (count ?? 0) > 0, [count]);
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
