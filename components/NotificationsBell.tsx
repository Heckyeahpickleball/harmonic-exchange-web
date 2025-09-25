'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type NType = 'request_received' | 'request_accepted' | 'request_declined' | 'request_fulfilled' | 'system';

type Notif = {
  id: string;
  profile_id: string;
  type: NType;
  data: any;
  read_at: string | null;
  created_at: string;
};

export default function NotificationsBell() {
  const [userId, setUserId] = useState<string | null>(null);
  const [unread, setUnread] = useState<number>(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const closeRef = useRef<HTMLDivElement | null>(null);

  // load auth + initial counts/list
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id ?? null;
      setUserId(uid);
      if (!uid) return;
      await Promise.all([refreshCount(uid), refreshList(uid)]);
    })();
  }, []);

  // realtime push
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `profile_id=eq.${userId}` },
        async () => {
          // new item for me → bump count & reload
          await Promise.all([refreshCount(userId), refreshList(userId)]);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // outside click to close
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!open) return;
      if (closeRef.current && !closeRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  async function refreshCount(uid: string) {
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', uid)
      .is('read_at', null);
    setUnread(count ?? 0);
  }

  async function refreshList(uid: string) {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('profile_id', uid)
      .order('created_at', { ascending: false })
      .limit(12);
    setItems((data || []) as Notif[]);
  }

  async function markAllRead() {
    if (!userId) return;
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('profile_id', userId).is('read_at', null);
    await Promise.all([refreshCount(userId), refreshList(userId)]);
  }

  function label(n: Notif) {
    const o = n.data?.offer_id ? <Link href={`/offers/${n.data.offer_id}`} className="underline">offer</Link> : 'offer';
    switch (n.type) {
      case 'request_received':
        return <>New request on {o}</>;
      case 'request_accepted':
        return <>Your request was <strong>accepted</strong></>;
      case 'request_declined':
        return <>Your request was <strong>declined</strong></>;
      case 'request_fulfilled':
        return <>Request marked <strong>fulfilled</strong></>;
      default:
        return <>Update</>;
    }
  }

  if (!userId) return null;

  return (
    <div className="relative" ref={closeRef}>
      <button
        onClick={() => setOpen(v => !v)}
        className="relative rounded border px-3 py-1 text-sm hover:bg-gray-50"
        aria-label="Notifications"
      >
        🔔
        {!!unread && (
          <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1 text-[10px] leading-none text-white">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded border bg-white shadow">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <div className="text-sm font-medium">Notifications</div>
            <button onClick={markAllRead} className="text-xs underline">
              Mark all read
            </button>
          </div>
          <ul className="max-h-80 overflow-auto p-2">
            {items.map((n) => (
              <li key={n.id} className={`rounded px-2 py-2 text-sm ${n.read_at ? '' : 'bg-amber-50'}`}>
                <div>{label(n)}</div>
                <div className="mt-1 text-[11px] text-gray-500">{new Date(n.created_at).toLocaleString()}</div>
              </li>
            ))}
            {items.length === 0 && <li className="p-3 text-sm text-gray-600">No notifications.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
