// File: components/NotificationsBell.tsx
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
  // data may contain: { offer_id, offer_title, request_id, requester_name, message_id, message, sender_name }
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

  // caches to avoid repeated fetches
  const titleCache = useRef<Map<string, string>>(new Map()); // offer_id -> title
  const requesterCache = useRef<Map<string, string>>(new Map()); // request_id -> requester display name
  const messageCache = useRef<Map<string, { body: string; request_id: string }>>(new Map()); // message_id -> info

  // ---------- enrichment helpers ----------

  async function enrichOfferTitles(notifs: Notif[]) {
    const missing = Array.from(
      new Set(
        notifs
          .map(n => (n?.data?.offer_title ? null : n?.data?.offer_id))
          .filter((v): v is string => !!v && !titleCache.current.has(v))
      )
    );
    if (!missing.length) return;

    const { data } = await supabase.from('offers').select('id,title').in('id', missing);
    for (const row of (data || []) as { id: string; title: string }[]) {
      titleCache.current.set(row.id, row.title);
    }

    setRows(prev =>
      prev.map(n => {
        const oid = n?.data?.offer_id as string | undefined;
        if (!oid) return n;
        const t = titleCache.current.get(oid);
        if (!t) return n;
        return { ...n, data: { ...n.data, offer_title: n.data?.offer_title ?? t } };
      })
    );
  }

  async function enrichRequesterNames(notifs: Notif[]) {
    const ids = Array.from(
      new Set(
        notifs
          .map(n => (n.type === 'request_received' && !n?.data?.requester_name ? n?.data?.request_id : null))
          .filter((v): v is string => !!v && !requesterCache.current.has(v))
      )
    );
    if (!ids.length) return;

    const { data } = await supabase
      .from('requests')
      .select('id, requester:profiles(id, display_name)')
      .in('id', ids);

    for (const r of (data || []) as any[]) {
      requesterCache.current.set(r.id, r.requester?.display_name || 'Someone');
    }

    setRows(prev =>
      prev.map(n => {
        const rid = n?.data?.request_id as string | undefined;
        if (!rid) return n;
        const name = requesterCache.current.get(rid);
        if (!name) return n;
        return { ...n, data: { ...n.data, requester_name: n.data?.requester_name ?? name } };
      })
    );
  }

  async function enrichMessagePreviews(notifs: Notif[]) {
    const ids = Array.from(
      new Set(
        notifs
          .map(n => (n.type === 'message_received' && !n?.data?.message ? n?.data?.message_id : null))
          .filter((v): v is string => !!v && !messageCache.current.has(v))
      )
    );
    if (!ids.length) return;

    const { data } = await supabase
      .from('request_messages')
      .select('id, body, request_id')
      .in('id', ids);

    for (const m of (data || []) as any[]) {
      messageCache.current.set(m.id, { body: m.body as string, request_id: m.request_id as string });
    }

    setRows(prev =>
      prev.map(n => {
        const mid = n?.data?.message_id as string | undefined;
        if (!mid) return n;
        const info = messageCache.current.get(mid);
        if (!info) return n;
        return { ...n, data: { ...n.data, message: n.data?.message ?? info.body } };
      })
    );
  }

  function label(n: Notif): { text: string; href?: string } {
    const t = n.data?.offer_title as string | undefined;
    const reqName = n.data?.requester_name as string | undefined;
    const body = n.data?.message as string | undefined;

    switch (n.type) {
      case 'request_received':
        return { text: `New request${t ? ` for “${t}”` : ''}${reqName ? ` from ${reqName}` : ''}`, href: '/exchanges' };
      case 'request_accepted':
        return { text: `Your request was accepted${t ? ` — “${t}”` : ''}`, href: '/exchanges' };
      case 'request_declined':
        return { text: `Your request was declined${t ? ` — “${t}”` : ''}`, href: '/exchanges' };
      case 'request_fulfilled':
        return { text: `Request marked fulfilled${t ? ` — “${t}”` : ''}`, href: '/exchanges' };
      case 'message_received': {
        const snip = body ? `: ${body.slice(0, 80)}` : '';
        return { text: `New message${t ? ` on “${t}”` : ''}${snip}`, href: '/messages' };
      }
      default:
        return { text: n.data?.message || 'Update', href: '/exchanges' };
    }
  }

  async function markAllRead() {
    if (!uid) return;
    const ids = rows.filter(r => !r.read_at).map(r => r.id);
    if (!ids.length) return;
    const nowISO = new Date().toISOString();
    setRows(prev => prev.map(r => (ids.includes(r.id) ? { ...r, read_at: nowISO } : r)));
    await supabase.from('notifications').update({ read_at: nowISO }).in('id', ids);
  }

  // ---------- effects ----------

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

      enrichOfferTitles(initial).catch(() => {});
      enrichRequesterNames(initial).catch(() => {});
      enrichMessagePreviews(initial).catch(() => {});

      const chIns = supabase
        .channel('realtime:notifications:ins')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `profile_id=eq.${u}` },
          async (payload) => {
            const n = payload.new as Notif;
            setRows(prev => [n, ...prev].slice(0, 50));
            await Promise.allSettled([
              enrichOfferTitles([n]),
              enrichRequesterNames([n]),
              enrichMessagePreviews([n]),
            ]);
          }
        )
        .subscribe();

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

  async function toggleOpen() {
    setOpen(v => !v);
    if (!open) await markAllRead();
  }

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
                        onClick={() => {
                          if (!n.read_at) {
                            supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id)
                              .then(() => {});
                          }
                        }}
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
