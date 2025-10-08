// components/NotificationsBell.tsx
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
  const rootRef = useRef<HTMLDivElement | null>(null);

  // counts
  const unreadTotal = useMemo(() => rows.filter((r) => !r.read_at).length, [rows]);
  const unreadMessages = useMemo(
    () => rows.filter((r) => r.type === 'message_received' && !r.read_at).length,
    [rows]
  );
  const badgeNumber = unreadMessages > 0 ? unreadMessages : unreadTotal;

  // De-dupe caches
  const titleCache = useRef(new Map<string, string>());
  const requesterCache = useRef(new Map<string, string>());
  const sigSeen = useRef<Set<string>>(new Set());

  function sig(n: Notif) {
    return `${n.profile_id}|${n.type}|${n.data?.offer_id ?? ''}|${n.data?.request_id ?? ''}|${n.data?.track ?? ''}|${
      n.data?.tier ?? ''
    }`;
  }

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
        return { text: `Request marked fulfilled${offerTitle ? ` — “${offerTitle}”` : ''}`, href: '/exchanges?tab=fulfilled' };

      case 'badge_earned': {
        const track = n.data?.track as string | undefined;
        const tier = n.data?.tier as number | undefined;
        const niceTrack =
          track === 'give' ? 'Giver'
          : track === 'receive' ? 'Receiver'
          : track === 'streak' ? 'Streak'
          : track === 'completed_exchange' ? 'Completed Exchanges'
          : track === 'requests_made' ? 'Requests Made'
          : track === 'shared_offers' ? 'Offers Shared'
          : track ?? 'Badge';
        const text = `🎉 New badge earned — ${niceTrack}${tier != null ? ` (Tier ${tier})` : ''}`;
        return { text, href: '/profile#badges' };
      }

      case 'message':
      case 'message_received': {
        const snip = body ? `: ${body.slice(0, 80)}` : '';
        const on = offerTitle ? ` on “${offerTitle}”` : '';
        // IMPORTANT: go straight to /messages and pass the request id for preselect
        const href = reqId ? `/messages?request=${encodeURIComponent(reqId)}` : '/messages';
        return { text: `New message${on}${snip}`, href };
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

  // Load + realtime
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

  // Click-outside + Escape to close
  useEffect(() => {
    if (!open) return;

    const onDown = (e: MouseEvent | TouchEvent) => {
      const root = rootRef.current;
      if (!root) return;
      const t = e.target as Node | null;
      if (t && root.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // smooth, glitch-free navigation after closing the panel
  function navigateSafely(href: string) {
    setOpen(false);
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    requestAnimationFrame(() => {
      router.push(href);
    });
  }

  const listClass =
    'overflow-auto sm:max-h-[55vh] sm:rounded-b-xl ' +
    'max-h-[calc(85dvh-110px)] pb-[env(safe-area-inset-bottom)]';

  return (
    <div ref={rootRef} className="relative">
      <button
        className="hx-btn hx-btn--outline-primary text-sm px-3 py-2 relative"
        onClick={() => {
          setOpen((v) => !v);
        }}
        title="Notifications"
        aria-label="Open notifications"
        aria-haspopup="menu"
        aria-expanded={open}
        type="button"
      >
        <span aria-hidden>🔔</span>
        {badgeNumber > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[var(--hx-brand)] px-1 text-[11px] font-bold text-white">
            {badgeNumber > 99 ? '99+' : badgeNumber}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Notifications"
          className={[
            'hx-card z-50 p-0',
            'sm:absolute sm:right-0 sm:top-full sm:mt-2 sm:w-[360px] sm:max-w-[92vw]',
            'fixed inset-x-2 top-2 mx-auto w-[calc(100vw-1rem)] max-w-[560px] sm:static',
            'max-h-[85dvh] rounded-xl overflow-hidden',
          ].join(' ')}
        >
          {/* MOBILE header: Notifications / Messages */}
          <div className="block sm:hidden p-2 border-b">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {}}
                className="hx-btn hx-btn--outline-primary text-sm w-full"
              >
                Notifications
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  navigateSafely('/messages');
                }}
                className="hx-btn hx-btn--primary text-sm w-full"
              >
                Messages
              </button>
            </div>
          </div>

          {/* DESKTOP header */}
          <div className="hidden sm:flex items-center justify-between border-b px-3 py-2">
            <strong className="text-sm">Notifications</strong>
            <button onClick={markAllRead} className="hx-btn hx-btn--secondary text-xs px-2 py-1" type="button">
              Mark all read
            </button>
          </div>

          {/* CONTENT (scrollable list) */}
          <ul className={listClass}>
            {rows.length === 0 && (
              <li className="px-3 py-3 text-sm text-[var(--hx-muted)]">No notifications.</li>
            )}
            {rows.map((n) => {
              const { text, href } = label(n);
              const ts = new Date(n.created_at).toLocaleString();
              const isUnread = !n.read_at;
              return (
                <li
                  key={n.id}
                  className={[
                    'border-b px-3 py-2 text-sm transition-colors',
                    isUnread ? 'bg-teal-50/50' : '',
                  ].join(' ')}
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
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          await markOneRead(n.id);
                          navigateSafely(href);
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

          {/* DESKTOP: quick Messages button */}
          <div className="hidden sm:block border-t p-2">
            <button
              type="button"
              className="hx-btn hx-btn--primary w-full text-sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                navigateSafely('/messages');
              }}
            >
              Messages
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
