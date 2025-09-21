'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type NotificationType =
  | 'request_received'
  | 'request_accepted'
  | 'request_declined'
  | 'system';

type NotificationRow = {
  id: string;
  profile_id: string;
  type: NotificationType;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string; // ISO
};

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes?.user?.id;
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
    let unsubscribed = false;

    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id;
      if (!userId || unsubscribed) return;

      const channel = supabase
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
            // refresh count/list on any insert/update
            void load();
          }
        );

      // subscribe (don’t return the promise to React)
      void channel.subscribe();

      // cleanup (must NOT be async)
      return () => {
        supabase.removeChannel(channel);
      };
    })();

    return () => {
      unsubscribed = true;
    };
  }, [load]);

  const markAllRead = useCallback(async () => {
    setBusy(true);
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes?.user?.id;
    if (!userId) {
      setBusy(false);
      return;
    }

    // set read_at for all unread notifications for this user
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .is('read_at', null)
      .eq('profile_id', userId);

    if (!error) await load();
    setBusy(false);
  }, [load]);

  return (
    <section className="max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Notifications</h2>
        <button
          onClick={markAllRead}
          disabled={busy}
          className="rounded border px-3 py-1 text-sm disabled:opacity-50"
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
            const d = n.data || {};
            const offerId =
              typeof d['offer_id'] === 'string' ? (d['offer_id'] as string) : undefined;
            const requestId =
              typeof d['request_id'] === 'string' ? (d['request_id'] as string) : undefined;

            return (
              <li
                key={n.id}
                className={`rounded border p-3 ${!n.read_at ? 'bg-yellow-50' : ''}`}
              >
                <div className="text-xs text-gray-500">
                  {new Date(n.created_at).toLocaleString()}
                </div>

                <div className="mt-1 text-sm">
                  {n.type === 'request_received' && 'You received a new request.'}
                  {n.type === 'request_accepted' && 'Your request was accepted.'}
                  {n.type === 'request_declined' && 'Your request was declined.'}
                  {n.type === 'system' && 'System notification.'}
                </div>

                <div className="mt-2">
                  {offerId && (
                    <Link href={`/offers/${offerId}`} className="rounded border px-2 py-1 text-sm">
                      View offer
                    </Link>
                  )}{' '}
                  {requestId && (
                    <Link href="/inbox" className="rounded border px-2 py-1 text-sm">
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
