// components/NotificationsBell.tsx
'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
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
  | 'gratitude_prompt'
  | 'review_prompt'
  | 'system'
  | string;

type Notif = {
  id: string;
  type: NotifType;
  data: any;
  created_at: string;
  read_at: string | null;
  profile_id: string;
  request_id?: string | null;
  offer_id?: string | null;
  _fresh?: boolean;
};

export default function NotificationsBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [rows, setRows] = useState<Notif[]>([]);
  const unread = useMemo(() => rows.filter((r) => !r.read_at).length, [rows]);

  // Unread messages counter (for mobile Messages button badge)
  const unreadMsgs = useMemo(
    () =>
      rows.filter(
        (r) =>
          !r.read_at &&
          (r.type === 'message' || r.type === 'message_received'),
      ).length,
    [rows],
  );

  const [activeTab, setActiveTab] =
    useState<'notifications' | 'messages'>('notifications');

  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeTimer = useRef<number | null>(null);

  const scheduleClose = useCallback((delay = 0) => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), delay);
  }, []);
  const cancelScheduledClose = useCallback(() => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  // caches & dedupe
  const titleCache = useRef(new Map<string, string>());
  const requesterCache = useRef(new Map<string, string>());
  const sigSeen = useRef<Set<string>>(new Set());

  // Track if we are on mobile to change close/scroll behavior
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639.95px)');
    const set = () => setIsMobile(mq.matches);
    set();
    mq.addEventListener('change', set);
    return () => mq.removeEventListener('change', set);
  }, []);

  const getOfferId = (n: Notif) =>
    (n.data?.offer_id as string | undefined) || (n.offer_id || undefined);
  const getReqId = (n: Notif) =>
    (n.data?.request_id as string | undefined) || (n.request_id || undefined);

  async function enrichOfferTitles(notifs: Notif[]) {
    const missing = Array.from(
      new Set(
        notifs
          .map((n) => {
            const oid = getOfferId(n);
            return n?.data?.offer_title ? null : oid;
          })
          .filter((v): v is string => !!v && !titleCache.current.has(v)),
      ),
    );
    if (!missing.length) return;

    const { data } = await supabase
      .from('offers')
      .select('id,title')
      .in('id', missing);
    for (const row of (data || []) as { id: string; title: string }[]) {
      titleCache.current.set(row.id, row.title);
    }
    setRows((prev) =>
      prev.map((n) => {
        const oid = getOfferId(n);
        const t = oid ? titleCache.current.get(oid) : undefined;
        return t
          ? { ...n, data: { ...n.data, offer_title: n.data?.offer_title ?? t } }
          : n;
      }),
    );
  }

  async function enrichRequesterNames(notifs: Notif[]) {
    const ids = Array.from(
      new Set(
        notifs
          .map((n) =>
            n.type === 'request_received' && !n?.data?.requester_name
              ? getReqId(n)
              : null,
          )
          .filter((v): v is string => !!v && !requesterCache.current.has(v)),
      ),
    );
    if (!ids.length) return;

    const { data } = await supabase
      .from('requests')
      .select('id, requester:profiles(id, display_name)')
      .in('id', ids);

    for (const r of (data || []) as any[]) {
      requesterCache.current.set(
        r.id,
        r.requester?.display_name || 'Someone',
      );
    }

    setRows((prev) =>
      prev.map((n) => {
        const rid = getReqId(n);
        const name = rid ? requesterCache.current.get(rid) : undefined;
        return name
          ? {
              ...n,
              data: { ...n.data, requester_name: n.data?.requester_name ?? name },
            }
          : n;
      }),
    );
  }

function label(n: Notif): { text: string; href?: string } {
  const offerId = getOfferId(n);
  const offerTitle =
    (n.data?.offer_title as string | undefined) ||
    (offerId ? titleCache.current.get(offerId) : undefined);
  const body = (n.data?.text ?? n.data?.message) as string | undefined;
  const reqId = getReqId(n);

  // Prefer sending users to the Global feed for content activity
  const GLOBAL_HREF = '/global';

  switch (n.type) {
    /* ---------- existing cases (kept as-is) ---------- */
    case 'offer_pending': {
      const href = offerId
        ? `/admin?tab=offers&pending=1&offer=${offerId}`
        : '/admin?tab=offers&pending=1';
      return {
        text: `New offer pending${offerTitle ? `: “${offerTitle}”` : ''}`,
        href,
      };
    }
    case 'request_received':
      return {
        text: `New request${
          offerTitle ? ` for “${offerTitle}”` : ''
        }${n.data?.requester_name ? ` from ${n.data.requester_name}` : ''}`,
        href: '/exchanges?tab=received',
      };
    case 'request_accepted':
      return {
        text: `Your request was accepted${
          offerTitle ? ` — “${offerTitle}”` : ''
        }`,
        href: '/exchanges?tab=sent',
      };
    case 'request_declined':
      return {
        text: `Your request was declined${
          offerTitle ? ` — “${offerTitle}”` : ''
        }`,
        href: '/exchanges?tab=sent',
      };
    case 'request_fulfilled':
      return {
        text: `Request marked fulfilled${
          offerTitle ? ` — “${offerTitle}”` : ''
        }`,
        href: '/exchanges?tab=fulfilled',
      };

    case 'gratitude_prompt': {
      const text = `Say thanks${offerTitle ? ` for “${offerTitle}”` : ''}`;
      const href = reqId
        ? `/reviews/new?request_id=${encodeURIComponent(reqId)}`
        : '/reviews/new';
      return { text, href };
    }
    case 'review_prompt': {
      const text = `Please leave a review${
        offerTitle ? ` for “${offerTitle}”` : ''
      }`;
      const href = reqId
        ? `/gratitude/write?request_id=${encodeURIComponent(reqId)}`
        : '/reviews/new';
      return { text, href };
    }

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
      const text = `🎉 New badge earned — ${niceTrack}${
        tier != null ? ` (Tier ${tier})` : ''
      }`;
      return { text, href: '/profile#badges' };
    }

    case 'message':
    case 'message_received': {
      const snip = body ? `: ${body.slice(0, 80)}` : '';
      const on = offerTitle ? ` on “${offerTitle}”` : '';
      return {
        text: `New message${on}${snip}`,
        href: reqId ? `/messages?thread=${reqId}` : '/messages',
      };
    }

    case 'fulfillment_reminder': {
      const t = offerTitle ? ` “${offerTitle}”` : '';
      const href = reqId ? `/exchanges?focus=${reqId}` : '/exchanges';
      return { text: `Has your offer been fulfilled?${t}`, href };
    }

    /* ---------- NEW cases for hearts & comments ---------- */
    case 'heart_on_post': {
      const liker = (n.data?.liker_name as string | undefined) ?? 'Someone';
      return { text: `${liker} liked your post`, href: GLOBAL_HREF };
    }
    case 'heart_on_comment': {
      const liker = (n.data?.liker_name as string | undefined) ?? 'Someone';
      return { text: `${liker} liked your comment`, href: GLOBAL_HREF };
    }
    case 'comment_on_post': {
      const who = (n.data?.commenter_name as string | undefined) ?? 'Someone';
      const snip = n.data?.text ? `: ${String(n.data.text).slice(0, 80)}` : '';
      return { text: `${who} commented on your post${snip}`, href: GLOBAL_HREF };
    }

    /* ---------- fallback ---------- */
    default: {
      const text =
        (n.data?.message as string | undefined) ||
        (n.data?.text as string | undefined) ||
        'Update';
      return { text, href: GLOBAL_HREF };
    }
  }
}

  async function markAllRead() {
    if (!uid) return;
    const ids = rows.filter((r) => !r.read_at).map((r) => r.id);
    if (!ids.length) return;
    const now = new Date().toISOString();
    setRows((prev) =>
      prev.map((r) =>
        ids.includes(r.id) ? { ...r, read_at: now, _fresh: false } : r,
      ),
    );
    await supabase.from('notifications').update({ read_at: now }).in('id', ids);
  }

  async function markOneRead(id: string) {
    const found = rows.find((r) => r.id === id);
    if (!found || found.read_at) return;
    const now = new Date().toISOString();
    setRows((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, read_at: now, _fresh: false } : r,
      ),
    );
    await supabase.from('notifications').update({ read_at: now }).eq('id', id);
  }

  function sig(n: Notif) {
    const offerId = getOfferId(n) ?? '';
    const reqId = getReqId(n) ?? '';
    return `${n.profile_id}|${n.type}|${offerId}|${reqId}|${
      n.data?.track ?? ''
    }|${n.data?.tier ?? ''}`;
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data?.user?.id ?? null;
      setUid(u);
      if (!u) return; // logged out: skip loading notifications

      const { data: list } = await supabase
        .from('notifications')
        .select(
          'id,type,data,created_at,read_at,profile_id,request_id,offer_id',
        )
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

      void Promise.allSettled([
        enrichOfferTitles(dedup),
        enrichRequesterNames(dedup),
      ]);

      const chIns = supabase
        .channel('realtime:notifications:ins')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `profile_id=eq.${u}`,
          },
          async (payload) => {
            const n = payload.new as Notif;
            const s = sig(n);
            if (sigSeen.current.has(s)) return;
            sigSeen.current.add(s);
            const fresh = { ...n, _fresh: true };
            setRows((prev) => [fresh, ...prev].slice(0, 50));
            await Promise.allSettled([
              enrichOfferTitles([fresh]),
              enrichRequesterNames([fresh]),
            ]);
          },
        )
        .subscribe();

      const chUpd = supabase
        .channel('realtime:notifications:upd')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `profile_id=eq.${u}`,
          },
          (payload) => {
            const upd = payload.new as Notif;
            setRows((prev) =>
              prev.map((r) =>
                r.id === upd.id
                  ? { ...r, read_at: upd.read_at ?? null, _fresh: false }
                  : r,
              ),
            );
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(chIns);
        supabase.removeChannel(chUpd);
      };
    })();
  }, []);

  // Outside click / escape to close
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const root = rootRef.current;
      if (!root) return;
      const target = e.target as Node | null;
      if (!target || !root.contains(target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);

    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Lock background scroll on mobile when panel is open
  useEffect(() => {
    if (open && isMobile) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open, isMobile]);

  // Only schedule close on pointer/mouse leave for non-mobile (fixes mobile scrolling)
  const isNode = (v: any): v is Node =>
    !!v && typeof v === 'object' && typeof (v as any).nodeType === 'number';

  const handlePanelLeave = (
    evt: React.MouseEvent | React.PointerEvent,
  ) => {
    const anyEvt = evt as any;
    const pointerType = anyEvt?.nativeEvent?.pointerType as
      | 'mouse'
      | 'pen'
      | 'touch'
      | undefined;

    if (isMobile || (pointerType && pointerType !== 'mouse')) {
      cancelScheduledClose();
      return;
    }

    const next = (anyEvt.relatedTarget ?? anyEvt.toElement) ?? null;
    const root = rootRef.current;
    if (root && isNode(next) && root.contains(next)) {
      cancelScheduledClose();
      return;
    }
    scheduleClose(0);
  };

  // Cancel any scheduled close while actively scrolling inside the list
  const onScrollCapture = () => cancelScheduledClose();
  const onWheelCapture = () => cancelScheduledClose();
  const onTouchMoveCapture = () => cancelScheduledClose();

  const listClass =
    'overflow-auto sm:max-h-[70vh] sm:rounded-b-xl max-h-[calc(85dvh-110px)] pb-[env(safe-area-inset-bottom)]';

  // === Logged-out behavior: clicking the bell goes to /sign-in ===
  if (!uid) {
    return (
      <button
        className="hx-btn hx-btn--outline-primary text-sm px-3 py-2 relative"
        onClick={() => router.push('/sign-in')}
        title="Notifications"
        aria-label="Open notifications"
        type="button"
      >
        <span aria-hidden>🔔</span>
      </button>
    );
  }

  return (
    <div ref={rootRef} className="relative" onMouseEnter={cancelScheduledClose}>
      <button
        className="hx-btn hx-btn--outline-primary text-sm px-3 py-2 relative"
        onClick={() => {
          setActiveTab('notifications');
          setOpen((v) => !v);
        }}
        title="Notifications"
        aria-label="Open notifications"
        aria-haspopup="menu"
        aria-expanded={open}
        type="button"
      >
        <span aria-hidden>🔔</span>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[var(--hx-brand)] px-1 text-[11px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="menu"
          aria-label="Notifications"
          onMouseEnter={cancelScheduledClose}
          onMouseLeave={isMobile ? undefined : handlePanelLeave}
          onPointerEnter={cancelScheduledClose}
          onPointerLeave={isMobile ? undefined : handlePanelLeave}
          className={[
            // Desktop (>= sm): anchor to bell, fixed width and max height
            'sm:absolute sm:right-0 sm:top-full sm:mt-2 sm:w-[360px] sm:max-w-[92vw] sm:mx-0 sm:inset-auto',
            // Mobile (< sm): full-width sheet
            'fixed inset-x-2 top-2 mx-auto w-[calc(100vw-1rem)] max-w-[560px]',
            // Shared
            'hx-card z-50 max-h-[85dvh] rounded-xl overflow-hidden p-0 shadow-xl',
          ].join(' ')}
        >
          {/* Mobile header with Messages button + badge */}
          <div className="block sm:hidden p-2 border-b">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('notifications')}
                className="hx-btn hx-btn--outline-primary text-sm w-full"
              >
                Notifications
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('messages');
                  setOpen(false);
                  router.push('/messages');
                }}
                className="hx-btn hx-btn--primary text-sm w-full relative"
              >
                <span>Messages</span>
                {unreadMsgs > 0 && (
                  <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[var(--hx-brand)] px-1 text-[11px] font-bold text-white">
                    {unreadMsgs > 99 ? '99+' : unreadMsgs}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Desktop header */}
          <div className="hidden sm:flex items-center justify-between border-b px-3 py-2">
            <strong className="text-sm">Notifications</strong>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push('/messages');
                }}
                className="hx-btn hx-btn--primary text-xs px-2 py-1 relative"
                title="Go to Messages"
                aria-label="Go to Messages"
              >
                Messages
              </button>
              <button
                onClick={markAllRead}
                className="hx-btn hx-btn--secondary text-xs px-2 py-1"
                type="button"
                title="Mark all read"
                aria-label="Mark all read"
              >
                Mark all read
              </button>
            </div>
          </div>

          <ul
            className={listClass}
            onScrollCapture={onScrollCapture}
            onWheelCapture={onWheelCapture}
            onTouchMoveCapture={onTouchMoveCapture}
          >
            {rows.length === 0 && (
              <li className="px-3 py-3 text-sm text-[var(--hx-muted)]">
                No notifications.
              </li>
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
                        <div className="text-[11px] text-[var(--hx-muted)]">
                          {ts}
                        </div>
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
                          router.push(href);
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
