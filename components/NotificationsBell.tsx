'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type Notif = {
  id: string;
  type: 'request_received' | 'request_accepted' | 'request_declined' | 'request_fulfilled' | 'message_received' | 'system' | string;
  data: any;
  created_at: string;
  read_at: string | null;
  profile_id: string;
};

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [rows, setRows] = useState<Notif[]>([]);
  const unread = useMemo(() => rows.filter(r => !r.read_at).length, [rows]);

  // Load current user + initial list
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data?.user?.id ?? null;
      setUid(u);
      if (!u) return;

      const { data: list } = await supabase
        .from('notifications')
        .select('id,type,data,created_at,read_at,profile_id')
        .eq('profile_id', u)
        .order('created_at', { ascending: false })
        .limit(50);
      setRows((list || []) as Notif[]);

      // realtime: new notifications
      const channel = supabase
        .channel('realtime:notifications')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `profile_id=eq.${u}` },
          (payload) => {
            setRows(prev => [payload.new as Notif, ...prev].slice(0, 50));
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    })();
  }, []);

  async function markAllRead() {
    if (!uid || unread === 0) return;
    const ids = rows.filter(r => !r.read_at).map(r => r.id);
    setRows(prev => prev.map(r => (ids.includes(r.id) ? { ...r, read_at: new Date().toISOString() } : r)));
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids);
  }

  function label(n: Notif): { text: string; href?: string } {
    const offerTitle = n.data?.offer_title;
    switch (n.type) {
      case 'request_received':
        return { text: `New request${offerTitle ? ` for “${offerTitle}”` : ''}`, href: '/inbox' };
      case 'request_accepted':
        return { text: `Your request was accepted${offerTitle ? ` — “${offerTitle}”` : ''}`, href: '/inbox' };
      case 'request_declined':
        return { text: `Your request was declined${offerTitle ? ` — “${offerTitle}”` : ''}`, href: '/inbox' };
      case 'request_fulfilled':
        return { text: `Request marked fulfilled${offerTitle ? ` — “${offerTitle}”` : ''}`, href: '/inbox' };
      case 'message_received':
        return { text: `New message${offerTitle ? ` on “${offerTitle}”` : ''}`, href: '/inbox' };
      default:
        return { text: n.data?.message || 'Update', href: '/inbox' };
    }
  }

  return (
    <div className="relative">
      <button
        className="relative rounded border px-2 py-1 text-sm"
        onClick={async () => {
          setOpen(v => !v);
          if (!open) await markAllRead();
        }}
        title="Notifications"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-amber-500 px-1 text-[11px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[320px] max-w-[90vw] rounded border bg-white shadow">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <strong className="text-sm">Notifications</strong>
            <button onClick={markAllRead} className="text-xs underline">Mark all read</button>
          </div>

          <ul className="max-h-[50vh] overflow-auto">
            {rows.length === 0 && (
              <li className="px-3 py-3 text-sm text-gray-600">No notifications.</li>
            )}
            {rows.map((n) => {
              const { text, href } = label(n);
              const ts = new Date(n.created_at).toLocaleString();
              return (
                <li key={n.id} className={`border-b px-3 py-2 text-sm ${!n.read_at ? 'bg-amber-50' : ''}`}>
                  <div className="text-[11px] text-gray-500">{ts}</div>
                  <div className="flex items-center justify-between gap-2">
                    <div>{text}</div>
                    {href && (
                      <Link href={href} className="whitespace-nowrap text-xs underline">
                        View
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
