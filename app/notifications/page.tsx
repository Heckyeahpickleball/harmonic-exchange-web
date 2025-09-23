'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type NotificationType =
  | 'request_received'
  | 'request_accepted'
  | 'request_declined'
  | 'request_fulfilled'
  | 'system';

type NotifData = {
  offer_id?: string;
  request_id?: string;
  status?: 'pending' | 'accepted' | 'declined' | 'fulfilled';
  request_status?: 'pending' | 'accepted' | 'declined' | 'fulfilled';
  message?: string;
  [k: string]: unknown;
};

type NotificationRow = {
  id: string;
  profile_id: string;
  type: NotificationType;
  data: NotifData;
  read_at: string | null;
  created_at: string; // ISO string
};

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('profile_id', userId)
      .order('created_at', { ascending: false });

    if (!error && data) setItems(data as NotificationRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    // initial fetch
    void load();

    // realtime subscription for this user’s notifications
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id;
      if (!userId) return;

      channel = supabase
        .channel('notif_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `profile_id=eq.${userId}`,
          },
          () => {
            // refresh list/count on any insert/update/delete
            void load();
          }
        );

      // subscribe (don’t block React)
      void channel.subscribe();
    })();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [load]);

  const markAllRead = useCallback(async () => {
    setBusy(true);
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    if (!userId) {
      setBusy(false);
      return;
    }

    // mark unread as read
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .is('read_at', null)
      .eq('profile_id', userId);

    if (!error) {
      // optimistic UI
      setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    }
    setBusy(false);
  }, []);

  function describe(n: NotificationRow): string {
    switch (n.type) {
      case 'request_received':
        return 'You received a new request.';
      case 'request_accepted':
        return 'Your request was accepted.';
      case 'request_declined':
        return 'Your request was declined.';
      case 'request_fulfilled':
        return 'Request marked as fulfilled.';
      case 'system':
      default: {
        // Try to infer from payload for legacy "system" rows
        const status = n.data?.status ?? n.data?.request_status;
        if (status === 'fulfilled') return 'Request marked as fulfilled.';
        if (status === 'accepted') return 'Your request was accepted.';
        if (status === 'declined') return 'Your request was declined.';
        return n.data?.message ?? 'System notification.';
      }
    }
  }

  const unreadCount = items.filter((n) => !n.read_at).length;

  return (
    <section className="max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Notifications</h2>
        <button
          onClick={markAllRead}
          disabled={busy || unreadCount === 0}
          className="rounded border px-3 py-1 text-sm disabled:opacity-50"
          title={unreadCount ? `Mark ${unreadCount} as read` : 'All caught up'}
        >
          {busy ? 'Marking…' : 'Mark all read'}
        </button>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : items.length === 0 ? (
        <p>No notifications yet.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((n) => {
            const d: NotifData = n.data ?? {};
            const offerId = typeof d.offer_id === 'string' ? d.offer_id : undefined;
            const requestId = typeof d.request_id === 'string' ? d.request_id : undefined;

            return (
              <li
                key={n.id}
                className={`rounded border p-3 ${!n.read_at ? 'bg-yellow-50' : ''}`}
              >
                <div className="text-xs text-gray-500">
                  {new Date(n.created_at).toLocaleString()}
                </div>

                <div className="mt-1 text-sm">{describe(n)}</div>

                <div className="mt-2 flex gap-2">
                  {offerId && (
                    <Link
                      href={`/offers/${offerId}`}
                      className="rounded border px-2 py-1 text-sm hover:bg-gray-50"
                    >
                      View offer
                    </Link>
                  )}
                  {(requestId || n.type.startsWith('request_')) && (
                    <Link
                      href="/inbox"
                      className="rounded border px-2 py-1 text-sm hover:bg-gray-50"
                    >
                      View request
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
