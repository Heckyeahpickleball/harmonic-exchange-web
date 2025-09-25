'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type NotifType =
  | 'request_received'
  | 'request_accepted'
  | 'request_declined'
  | 'request_fulfilled'
  | 'message_received'
  | 'system'
  | string;

type Notif = {
  id: string;
  type: NotifType;
  data: any; // may contain { offer_id, offer_title, request_id, message, ... }
  created_at: string;
  read_at: string | null;
  profile_id: string;
};

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [rows, setRows] = useState<Notif[]>([]);
  const unread = useMemo(() => rows.filter(r => !r.read_at).length, [rows]);

  // simple title cache so we don't refetch the same offer title
  const titleCache = useRef<Map<string, string>>(new Map());

  // ------------- helpers ----------------

  // Enrich any notifications missing data.offer_title (but with data.offer_id)
  async function enrichOfferTitles(notifs: Notif[]) {
    const missingIds = Array.from(
      new Set(
        notifs
          .map(n => n?.data?.offer_title ? null : n?.data?.offer_id)
          .filter((v): v is string => !!v && !titleCache.current.has(v))
      )
    );

    if (missingIds.length === 0) return;

    const { data } = await supabase
      .from('offers')
      .select('id,title')
      .in('id', missingIds);

    for (const row of (data || []) as { id: string; title: string }[]) {
      titleCache.current.set(row.id, row.title);
    }

    // patch local rows with titles (if any)
    setRows(prev =>
      prev.map(n => {
        const oid = n?.data?.offer_id as string | undefined;
        if (!oid) return n;
        const t = titleCache.current.get(oid);
        if (!t) return n;
        return { ...n, data: { ...n.data, offer_title: n.data?.offer_title ?? t } };
    }));
  }

  function label(n: Notif): { text: string; href?: string } {
    const t = n.data?.offer_title;
    switch (n.type) {
      case 'request_received':
        return { text: `New request${t ? ` for “${t}”` : ''}`, href: '/inbox' };
      case 'request_accepted':
        return { text: `Your request was accepted${t ? ` — “${t}”` : ''}`, href: '/inbox' };
      case 'request_declined':
        return { text: `Your request was declined${t ? ` — “${t}”` : ''}`, href: '/inbox' };
      case 'request_fulfilled':
        return { text: `Request marked fulfilled${t ? ` — “${t}”` : ''}`, href: '/inbox' };
      case 'message_received':
        return { text: `New message${t ? ` on “${t}”` : ''}`, href: '/inbox' };
      default:
        return { text: n.data?.message || 'Update', href: '/inbox' };
    }
  }

  async function markAllRead() {
    if (!uid) return;
    const ids = rows.filter(r => !r.read_at).map(r => r.id);
    if (ids.length === 0) return;

    // Optimistic UI
    const nowISO = new Date().toISOString();
    setRows(prev => prev.map(r => (ids.includes(r.id) ? { ...r, read_at: nowISO } : r)));

    await supabase
      .from('notifications')
      .update({ read_at: nowISO })
      .in('id', ids);
  }

  async function markOneRead(id: string) {
    const target = rows.find(r => r.id === id);
    if (!target || target.read_at) return; // already read
    const nowISO = new Date().toISOString();
    setRows(prev => prev.map(r => (r.id === id ? { ...r, read_at: nowISO } : r)));
    await supabase.from('notifications').update({ read_at: nowISO }).eq('id', id);
  }

  // ------------- effects ----------------

  // Load current user + initial batch + realtime
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

      const initial = (list || []) as Notif[];
      setRows(initial);
      enrichOfferTitles(initial).catch(() => { /* non-fatal */ });

      // realtime inserts (new notifications)
      const chIns = supabase
        .channel('realtime:notifications:ins')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `profile_id=eq.${u}` },
          async (payload) => {
            const n = payload.new as Notif;
            setRows(prev => [n, ...prev].slice(0, 50));
            // try to enrich title for this one
            if (!n?.data?.offer_title && n?.data?.offer_id) {
              await enrichOfferTitles([n]);
            }
          }
        )
        .subscribe();

      // realtime updates (e.g., read_at from another tab)
      const chUpd = supabase
        .channel('realtime:notifications:upd')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `profile_id=eq.${u}` },
          (payload) => {
            const upd = payload.new as Notif;
            setRows(prev => prev.map(r => (r.id === upd.id ? { ...r, read_at: upd.read_at } : r)));
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(chIns);
        supabase.removeChannel(chUpd);
      };
    })();
  }, []);

  // When opening the panel, immediately mark all as read
  async function toggleOpen() {
    setOpen(v => !v);
    // If currently closed (open === false), we're opening → mark read
    if (!open) await markAllRead();
  }

  // ------------- render ----------------

  return (
    <div className="relative">
      <button
        className="relative rounded border px-2 py-1 text-sm"
        onClick={toggleOpen}
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
        <div className="absolute right-0 z-50 mt-2 w-[340px] max-w-[90vw] rounded border bg-white shadow">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <strong className="text-sm">Notifications</strong>
            <button onClick={markAllRead} className="text-xs underline">Mark all read</button>
          </div>

          <ul className="max-h-[55vh] overflow-auto">
            {rows.length === 0 && (
              <li className="px-3 py-3 text-sm text-gray-600">No notifications.</li>
            )}

            {rows.map((n) => {
              const { text, href } = label(n);
              const ts = new Date(n.created_at).toLocaleString();
              return (
                <li
                  key={n.id}
                  className={`border-b px-3 py-2 text-sm ${!n.read_at ? 'bg-amber-50' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[11px] text-gray-500">{ts}</div>
                      <div>{text}</div>
                    </div>
                    {href && (
                      <Link
                        href={href}
                        className="whitespace-nowrap text-xs underline"
                        onClick={() => markOneRead(n.id)}
                      >
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
