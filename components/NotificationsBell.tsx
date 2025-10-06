'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type NotifType =
  | 'request_received'
  | 'request_accepted'
  | 'request_declined'
  | 'request_fulfilled'
  | 'message_received'
  | 'message'
  | 'offer_pending'
  | 'fulfillment_reminder'
  | 'badge_earned'
  | 'system'
  | string;

type Notif = {
  id: string;
  type: NotifType;
  data: any;
  created_at: string;
  read_at: string | null;
  profile_id: string;
  _fresh?: boolean;
};

export default function NotificationsBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [rows, setRows] = useState<Notif[]>([]);
  const unread = useMemo(() => rows.filter((r) => !r.read_at).length, [rows]);

  const titleCache = useRef(new Map<string, string>());
  const requesterCache = useRef(new Map<string, string>());
  const sigSeen = useRef<Set<string>>(new Set());

  async function enrichOfferTitles(notifs: Notif[]) {
    const missing = Array.from(
      new Set(
        notifs
          .map((n) => (n?.data?.offer_title ? null : n?.data?.offer_id))
          .filter((v): v is string => !!v && !titleCache.current.has(v)),
      ),
    );
    if (!missing.length) return;

    const { data } = await supabase.from('offers').select('id,title').in('id', missing);
    for (const row of (data || []) as { id: string; title: string }[]) {
      titleCache.current.set(row.id, row.title);
    }
    setRows((prev) =>
      prev.map((n) => {
        const oid = n?.data?.offer_id as string | undefined;
        const t = oid ? titleCache.current.get(oid) : undefined;
        return t ? { ...n, data: { ...n.data, offer_title: n.data?.offer_title ?? t } } : n;
      }),
    );
  }

  async function enrichRequesterNames(notifs: Notif[]) {
    const ids = Array.from(
      new Set(
        notifs
          .map((n) => (n.type === 'request_received' && !n?.data?.requester_name ? n?.data?.request_id : null))
          .filter((v): v is string => !!v && !requesterCache.current.has(v)),
      ),
    );
    if (!ids.length) return;

    const { data } = await supabase
      .from('requests')
      .select('id, requester:profiles(id, display_name)')
      .in('id', ids);

    for (const r of (data || []) as any[]) {
      requesterCache.current.set(r.id, r.requester?.display_name || 'Someone');
    }

    setRows((prev) =>
      prev.map((n) => {
        const rid = n?.data?.request_id as string | undefined;
        const name = rid ? requesterCache.current.get(rid) : undefined;
        return name ? { ...n, data: { ...n.data, requester_name: n.data?.requester_name ?? name } } : n;
      }),
    );
  }

  function label(n: Notif): { text: string; href?: string } {
    const offerId = n.data?.offer_id as string | undefined;
    const offerTitle = n.data?.offer_title as string | undefined;
    const body = (n.data?.text ?? n.data?.message) as string | undefined;
    const reqId = n.data?.request_id as string | undefined;

    switch (n.type) {
      case 'offer_pending': {
        const href = offerId ? `/admin?tab=offers&pending=1&offer=${offerId}` : '/admin?tab=offers&pending=1';
        return { text: `New offer pending${offerTitle ? `: “${offerTitle}”` : ''}`, href };
      }
      case 'request_received':
        return {
          text: `New request${offerTitle ? ` for “${offerTitle}”` : ''}${
            n.data?.requester_name ? ` from ${n.data.requester_name}` : ''
          }`,
          href: '/exchanges?tab=received',
        };
      case 'request_accepted':
        return { text: `Your request was accepted${offerTitle ? ` — “${offerTitle}”` : ''}`, href: '/exchanges?tab=sent' };
      case 'request_declined':
        return { text: `Your request was declined${offerTitle ? ` — “${offerTitle}”` : ''}`, href: '/exchanges?tab=sent' };
      case 'request_fulfilled':
        // Send them to the fulfilled tab (clearer than "sent")
        return { text: `Request marked fulfilled${offerTitle ? ` — “${offerTitle}”` : ''}`, href: '/exchanges?tab=fulfilled' };

      case 'badge_earned': {
        const track = n.data?.track as string | undefined;
        const tier = n.data?.tier as number | undefined;
        const niceTrack =
          track === 'give'
            ? 'Giver'
            : track === 'receive'
            ? 'Receiver'
            : track === 'streak'
            ? 'Streak'
            : track === 'completed_exchange'
            ? 'Completed Exchanges'
            : track === 'requests_made'
            ? 'Requests Made'
            : track === 'shared_offers'
            ? 'Offers Shared'
            : track ?? 'Badge';
        const text = `🎉 New badge earned — ${niceTrack}${tier != null ? ` (Tier ${tier})` : ''}`;
        // Jump to the badges anchor on Profile
        return { text, href: '/profile#badges' };
      }

      case 'message':
      case 'message_received': {
        const snip = body ? `: ${body.slice(0, 80)}` : '';
        const on = offerTitle ? ` on “${offerTitle}”` : '';
        return { text: `New message${on}${snip}`, href: reqId ? `/messages?thread=${reqId}` : '/messages' };
      }

      case 'fulfillment_reminder': {
        const t = offerTitle ? ` “${offerTitle}”` : '';
        const href = reqId ? `/exchanges?focus=${reqId}` : '/exchanges';
        return { text: `Has your offer been fulfilled?${t}`, href };
      }

      default: {
        const text = n.data?.message || n.data?.text || 'Update';
        return { text, href: '/exchanges' };
      }
    }
  }

  async function markAllRead() {
    if (!uid) return;
    const ids = rows.filter((r) => !r.read_at).map((r) => r.id);
    if (!ids.length) return;
    const now = new Date().toISOString();

    setRows((prev) => prev.map((r) => (ids.includes(r.id) ? { ...r, read_at: now, _fresh: false } : r)));
    await supabase.from('notifications').update({ read_at: now }).in('id', ids);
  }

  async function markOneRead(id: string) {
    const found = rows.find((r) => r.id === id);
    if (!found || found.read_at) return;
    const now = new Date().toISOString();
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, read_at: now, _fresh: false } : r)));
    await supabase.from('notifications').update({ read_at: now }).eq('id', id);
  }

  function sig(n: Notif) {
    return `${n.profile_id}|${n.type}|${n.data?.offer_id ?? ''}|${n.data?.request_id ?? ''}|${n.data?.track ?? ''}|${
      n.data?.tier ?? ''
    }`;
  }

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
      const seen = new Set<string>();
      const dedup: Notif[] = [];
      for (const n of initial) {
        const s = sig(n);
        if (seen.has(s)) continue;
        seen.add(s);
        dedup.push({ ...n, _fresh: false });
      }
      sigSeen.current = seen;
      setRows(dedup);

      void Promise.allSettled([enrichOfferTitles(dedup), enrichRequesterNames(dedup)]);

      const chIns = supabase
        .channel('realtime:notifications:ins')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `profile_id=eq.${u}` },
          async (payload) => {
            const n = payload.new as Notif;
            const s = sig(n);
            if (sigSeen.current.has(s)) return;
            sigSeen.current.add(s);
            const fresh = { ...n, _fresh: true };
            setRows((prev) => [fresh, ...prev].slice(0, 50));
            await Promise.allSettled([enrichOfferTitles([fresh]), enrichRequesterNames([fresh])]);
          },
        )
        .subscribe();

      const chUpd = supabase
        .channel('realtime:notifications:upd')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `profile_id=eq.${u}` },
          (payload) => {
            const upd = payload.new as Notif;
            setRows((prev) => prev.map((r) => (r.id === upd.id ? { ...r, read_at: upd.read_at ?? null, _fresh: false } : r)));
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(chIns);
        supabase.removeChannel(chUpd);
      };
    })();
  }, []);

  return (
    <div className="relative">
      <button
        className="hx-btn hx-btn--outline-primary text-sm px-3 py-2 relative"
        onClick={() => setOpen((v) => !v)}
        title="Notifications"
        aria-label="Open notifications"
        type="button"
      >
        <span aria-hidden>🔔</span>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[var(--hx-brand)] px-1 text-[11px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[360px] max-w-[92vw] hx-card p-0">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <strong className="text-sm">Notifications</strong>
            <button onClick={markAllRead} className="hx-btn hx-btn--secondary text-xs px-2 py-1" type="button">
              Mark all read
            </button>
          </div>

          <ul className="max-h-[55vh] overflow-auto">
            {rows.length === 0 && <li className="px-3 py-3 text-sm text-[var(--hx-muted)]">No notifications.</li>}

            {rows.map((n) => {
              const { text, href } = label(n);
              const ts = new Date(n.created_at).toLocaleString();
              const isUnread = !n.read_at;

              return (
                <li
                  key={n.id}
                  className={['border-b px-3 py-2 text-sm transition-colors', isUnread ? 'bg-teal-50/50' : ''].join(' ')}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {isUnread && (
                          <span
                            className={[
                              'mt-1 inline-block h-2 w-2 rounded-full bg-[var(--hx-brand)]',
                              n._fresh ? 'animate-pulse' : '',
                            ].join(' ')}
                            aria-hidden
                          />
                        )}
                        <div className="text-[11px] text-[var(--hx-muted)]">{ts}</div>
                      </div>
                      <div className="mt-0.5 break-words">{text}</div>
                    </div>

                    {href && (
                      <button
                        type="button"
                        className="hx-btn hx-btn--outline-primary text-xs px-2 py-1 shrink-0"
                        onClick={async () => {
                          await markOneRead(n.id);
                          setOpen(false);
                          router.push(href); // navigate (supports anchors like #badges)
                        }}
                        aria-label="View"
                        title="View"
                      >
                        View
                      </button>
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
