// /app/messages/page.tsx
'use client';

import {
  Suspense,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
  memo,
} from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

type ChatMsg = { id: string; created_at: string; text: string; sender_id: string };

type Thread = {
  peer_id: string;
  peer_name?: string;
  peer_avatar?: string | null;
  request_ids: string[];
  offer_ids: string[];
  offer_id: string;
  offer_title?: string;
  last_text?: string;
  last_at: string;
  unread: number;
};

type SharedOffer = { id: string; title: string };

const formatTS = (ts: string) => new Date(ts).toLocaleString();

/* ---------- auth ---------- */
function useMe() {
  const [me, setMe] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setMe(data?.user?.id ?? null);
    })();
  }, []);
  return me;
}

function Avatar({
  url,
  size = 36,
  alt = 'User',
}: {
  url?: string | null;
  size?: number;
  alt?: string;
}) {
  const s = `${size}px`;
  return url ? (
    <Image
      src={url}
      alt={alt}
      width={size}
      height={size}
      className="rounded-full object-cover"
      style={{ width: s, height: s }}
    />
  ) : (
    <div
      className="rounded-full bg-gray-200"
      style={{ width: s, height: s }}
      title={alt}
      aria-label={alt}
    />
  );
}

/* ---------- left column ---------- */
const ThreadsList = memo(function ThreadsList({
  threads,
  selectedPeer,
  onSelect,
}: {
  threads: Thread[];
  selectedPeer?: string;
  onSelect: (t: Thread) => void;
}) {
  return (
    <aside className="w-full md:w-80 shrink-0 md:border-r md:pr-2">
      <div className="mb-2 flex items-center justify-between md:mb-3">
        <h2 className="text-xl font-bold">Messages</h2>
        <span className="hidden text-xs text-gray-500 md:block">
          {threads.length} conversation{threads.length === 1 ? '' : 's'}
        </span>
      </div>

      <ul className="divide-y rounded border md:border-0">
        {threads.length === 0 && (
          <li className="px-3 py-3 text-sm text-gray-600">No conversations yet.</li>
        )}

        {threads.map((t) => {
          const active = selectedPeer === t.peer_id;
          return (
            <li
              key={t.peer_id}
              className={[
                'cursor-pointer px-3 py-3 hover:bg-gray-50',
                active ? 'bg-gray-100' : '',
              ].join(' ')}
              onClick={() => onSelect(t)}
            >
              <div className="flex items-center gap-3">
                <Avatar url={t.peer_avatar ?? null} alt={t.peer_name || 'Someone'} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{t.peer_name || 'Someone'}</div>
                      <div className="truncate text-gray-700 text-[13px]">
                        {t.offer_title || '—'}
                      </div>
                      <div className="truncate text-xs text-gray-500">{t.last_text || ''}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[11px] text-gray-500">
                        {t.last_at ? new Date(t.last_at).toLocaleTimeString() : ''}
                      </div>
                      {t.unread > 0 && (
                        <span className="mt-1 inline-flex min-w-[18px] justify-center rounded-full bg-amber-500 px-1 text-[11px] font-bold text-white">
                          {t.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
});

/* ---------- right column (chat) ---------- */
function ChatPane({
  me,
  thread,
  initialMsgs,
  onCache,
  onBackMobile,
  onLeaveChat,
}: {
  me: string;
  thread?: Thread;
  initialMsgs?: ChatMsg[];
  onCache: (peerId: string, msgs: ChatMsg[] | ((prev: ChatMsg[]) => ChatMsg[])) => void;
  onBackMobile: () => void;
  onLeaveChat: (peerId: string) => void;
}) {
  const [msgs, setMsgs] = useState<ChatMsg[]>(initialMsgs ?? []);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [shared, setShared] = useState<SharedOffer[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const messagesRef = useRef<HTMLDivElement>(null);
  const lastThreadRef = useRef<string | undefined>(undefined);

  const scrollToBottom = useCallback((smooth = true) => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  // Reset messages & draft on thread change
  useEffect(() => {
    setMsgs(initialMsgs ?? []);
    setDraft('');
    setErr(null);
  }, [thread?.peer_id, initialMsgs]);

  // Jump to bottom on open/switch
  useEffect(() => {
    if (!thread) return;
    if (lastThreadRef.current !== thread.peer_id) {
      lastThreadRef.current = thread.peer_id;
      requestAnimationFrame(() => scrollToBottom(false));
    }
  }, [thread, scrollToBottom]);

  // Keep pinned if near bottom on new msgs
  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    const threshold = 120;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distance <= threshold) scrollToBottom(true);
  }, [msgs, scrollToBottom]);

  // We allow send even if no request exists yet; we'll create one on the fly.
  const canSend = useMemo(() => !!thread && !!draft.trim() && !!me, [thread, draft, me]);

  // ---- Helpers to ensure a request exists (no offer required) ----
  const createPlaceholderOfferOwnedByMe = useCallback(
    async (): Promise<string | null> => {
      // (Kept for compatibility, no longer used by default path)
      const { data, error } = await supabase
        .from('offers')
        .insert([
          {
            owner_id: me,
            title: 'Direct message',
            offer_type: 'dm',
            is_online: true,
            city: null,
            country: null,
            images: [],
            status: 'archived',
          },
        ])
        .select('id')
        .single();
      if (error) return null;
      return (data as any)?.id ?? null;
    },
    [me]
  );

  // RLS-friendly: look up existing requests both directions; if none, anchor to a peer-owned offer with me as requester.
  const ensureRequestForThread = useCallback(
    async (peerId: string): Promise<{ request_id: string; offer_id: string | null } | null> => {
      // A) me -> peer
      {
        const { data, error } = await supabase
          .from('requests')
          .select('id, offer_id, offers!inner(id, owner_id)')
          .eq('requester_profile_id', me)
          .eq('offers.owner_id', peerId)
          .order('created_at', { ascending: false })
          .maybeSingle();

        if (!error && data?.id) {
          return { request_id: (data as any).id, offer_id: (data as any).offer_id ?? null };
        }
      }

      // B) peer -> me
      {
        const { data, error } = await supabase
          .from('requests')
          .select('id, offer_id, offers!inner(id, owner_id)')
          .eq('requester_profile_id', peerId)
          .eq('offers.owner_id', me)
          .order('created_at', { ascending: false })
          .maybeSingle();

        if (!error && data?.id) {
          return { request_id: (data as any).id, offer_id: (data as any).offer_id ?? null };
        }
      }

      // C) Anchor to peer's latest visible offer (any status); requester = me
      const { data: peerOffer } = await supabase
        .from('offers')
        .select('id')
        .eq('owner_id', peerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!peerOffer?.id) return null;

      const { data: inserted, error: insErr } = await supabase
        .from('requests')
        .insert([{ offer_id: peerOffer.id, requester_profile_id: me }])
        .select('id, offer_id')
        .single();

      if (insErr || !inserted?.id) return null;
      return { request_id: inserted.id, offer_id: inserted.offer_id ?? null };
    },
    [me]
  );
  // ----------------------------------------------------------------

  // Load/mark messages across all request_ids
  const reqCounter = useRef(0);
  const loadThread = useCallback(async () => {
    if (!thread) return;
    setErr(null);
    const turn = ++reqCounter.current;

    if (!thread.request_ids.length) {
      setMsgs([]);
      onCache(thread.peer_id, []);
      return;
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('id, created_at, type, data, read_at')
      .eq('profile_id', me)
      .or('type.eq.message,type.eq.message_received')
      .in('data->>request_id', thread.request_ids)
      .order('created_at', { ascending: true });

    if (reqCounter.current !== turn) return;
    if (error) {
      setErr(error.message);
      return;
    }

    const mapped: ChatMsg[] = (data || []).map((row: any) => ({
      id: row.id,
      created_at: row.created_at,
      text: (row.data?.text ?? row.data?.message) ?? '',
      sender_id: row.data?.sender_id ?? '',
    }));

    setMsgs(mapped);
    onCache(thread.peer_id, mapped);

    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('profile_id', me)
      .eq('type', 'message_received')
      .is('read_at', null)
      .in('data->>request_id', thread.request_ids);

    requestAnimationFrame(() => scrollToBottom(false));
  }, [me, thread, onCache, scrollToBottom]);

  // Shared offers between the two users
  const loadSharedOffers = useCallback(async () => {
    if (!thread) return;
    try {
      const ids = [me, thread.peer_id];
      const { data, error } = await supabase
        .from('requests')
        .select(`
          id,
          offer_id,
          offers!inner ( id, title, owner_id )
        `)
        .or(`offers.owner_id.in.(${ids.join(',')}),requester_profile_id.in.(${ids.join(',')})`)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;

      const uniq = new Map<string, SharedOffer>();
      for (const r of (data || []) as any[]) {
        if (r.offers?.id) uniq.set(r.offers.id, { id: r.offers.id, title: r.offers.title });
      }
      setShared(Array.from(uniq.values()));
    } catch {
      setShared([]);
    }
  }, [me, thread]);

  useEffect(() => {
    void loadThread();
    void loadSharedOffers();
  }, [loadThread, loadSharedOffers]);

  // Realtime across all request_ids (guard inside handler)
  useEffect(() => {
    if (!thread || !thread.request_ids.length) return;
    const ch = supabase
      .channel(`realtime:messages:peer:${thread.peer_id}:${me}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `profile_id=eq.${me}` },
        (payload) => {
          const n = payload.new as any;
          const rid = n?.data?.request_id;
          if (!rid || !thread.request_ids.includes(rid)) return;
          if (n.type === 'message' && n?.data?.sender_id === me) return;

          const msg: ChatMsg = {
            id: n.id,
            created_at: n.created_at,
            text: (n.data?.text ?? n.data?.message) ?? '',
            sender_id: n.data?.sender_id ?? '',
          };

          setMsgs((prev) => (prev.some((x) => x.id === msg.id) ? prev : [...prev, msg]));
          onCache(thread.peer_id, (prev) => {
            const arr = prev || [];
            return arr.some((x) => x.id === msg.id) ? arr : [...arr, msg];
          });

          if (n.type === 'message_received') {
            void supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [me, thread, onCache]);

  // Send (creates/anchors request if needed)
  const handleSend = useCallback(async () => {
    if (!thread) return;
    const text = draft.trim();
    if (!text) return;

    setErr(null);
    setSending(true);

    try {
      // Ensure anchor request exists with RLS-safe strategy
      let canonicalRequestId = thread.request_ids[0];
      let canonicalOfferId: string | null = thread.offer_id || null;

      if (!canonicalRequestId) {
        const ensured = await ensureRequestForThread(thread.peer_id);
        if (!ensured) {
          setErr("We couldn't create a new chat yet. Try again in a moment.");
          setSending(false);
          return;
        }
        canonicalRequestId = ensured.request_id;
        canonicalOfferId = ensured.offer_id;
      }

      const optimistic: ChatMsg = {
        id: `tmp-${Math.random().toString(36).slice(2)}`,
        created_at: new Date().toISOString(),
        text,
        sender_id: me,
      };
      setMsgs((m) => [...m, optimistic]);
      onCache(thread.peer_id, (prev) => [...(prev || []), optimistic]);
      setDraft('');
      requestAnimationFrame(() => scrollToBottom(true));

      const payload: any = { request_id: canonicalRequestId, sender_id: me, text };
      if (canonicalOfferId) payload.offer_id = canonicalOfferId;

      const now = new Date().toISOString();
      const { error } = await supabase.from('notifications').insert([
        { profile_id: me, type: 'message', data: payload, read_at: now },
        { profile_id: thread.peer_id, type: 'message_received', data: payload },
      ]);
      if (error) throw error;
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to send message.');
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [draft, me, thread, onCache, scrollToBottom, ensureRequestForThread]);

  if (!thread) {
    return (
      <div className="flex-1 md:block">
        <div className="rounded border p-6 text-sm text-gray-600">
          Select a conversation on the left to start chatting.
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1">
      <div className="rounded border">
        {/* Header */}
        <div className="border-b">
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                className="md:hidden mr-1 rounded border px-2 py-1 text-xs hover:bg-gray-50"
                onClick={onBackMobile}
                aria-label="Back to conversations"
                title="Back"
              >
                ← Back
              </button>

              <Avatar url={thread.peer_avatar ?? null} alt={thread.peer_name || 'Someone'} size={28} />
              <div className="min-w-0">
                <div className="truncate text-sm text-gray-600">
                  Chat with {thread.peer_name || 'Someone'}
                </div>
                <div className="truncate font-semibold">{thread.offer_title || '—'}</div>
              </div>
            </div>

            {/* Desktop actions */}
            <div className="hidden md:flex items-center gap-2">
              <a className="rounded border px-2 py-1 text-xs hover:bg-gray-50" href={`/u/${thread.peer_id}`}>
                View profile
              </a>
              <a className="rounded border px-2 py-1 text-xs hover:bg-gray-50" href={`/offers/${thread.offer_id}`}>
                View offer
              </a>
              <button
                type="button"
                className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                onClick={() => onLeaveChat(thread.peer_id)}
                aria-label="Leave this chat"
                title="Leave this chat"
              >
                Leave chat
              </button>
            </div>
          </div>

          {/* Mobile actions */}
          <div className="flex justify-end gap-2 px-3 pb-2 md:hidden">
            <a className="rounded border px-2 py-1 text-xs hover:bg-gray-50" href={`/u/${thread.peer_id}`}>
              View profile
            </a>
            <button
              type="button"
              className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
              onClick={() => onLeaveChat(thread.peer_id)}
              aria-label="Leave this chat"
              title="Leave this chat"
            >
              Leave chat
            </button>
          </div>

          {shared.length > 0 && (
            <div className="flex gap-2 overflow-x-auto px-3 pb-2">
              {shared.map((o) => (
                <a
                  key={o.id}
                  href={`/offers/${o.id}`}
                  className="shrink-0 rounded-full border px-3 py-1 text-xs hover:bg-gray-50"
                  title={o.title}
                >
                  {o.title}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Messages */}
        <div ref={messagesRef} className="max-h-[55vh] min-h-[45vh] overflow-auto p-3">
          {msgs.map((m) => {
            const mine = m.sender_id === me;
            return (
              <div
                key={m.id}
                className={`group relative mb-2 max-w-[85%] rounded px-3 py-2 text-sm ${
                  mine ? 'ml-auto bg-black text-white' : 'bg-gray-100'
                }`}
              >
                <div className="text-[11px] opacity-70">{formatTS(m.created_at)}</div>
                <div className="mt-1 whitespace-pre-wrap">{m.text}</div>
              </div>
            );
          })}
        </div>

        {/* Composer */}
        <div className="border-t p-3">
          {err && <div className="mb-2 text-sm text-red-600">{err}</div>}
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!sending) void handleSend();
            }}
          >
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (!sending) void handleSend();
                }
              }}
              rows={2}
              placeholder="Type a message…"
              className="flex-1 resize-none rounded border px-3 py-2 text-sm"
              aria-label="Type a message"
            />
            <button
              type="submit"
              disabled={sending || !canSend}
              className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-60"
            >
              {sending ? 'Sending…' : 'Send'}
            </button>
          </form>

          <div className="mt-1 text-[11px] text-gray-500">
            Enter to send • Shift+Enter for a new line
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- page shell (peer-grouped) ---------- */
function MessagesContent() {
  const me = useMe();

  const [threads, setThreads] = useState<Thread[]>([]);
  const [selected, setSelected] = useState<Thread | undefined>(undefined);
  const [msgCache, setMsgCache] = useState<Record<string, ChatMsg[]>>({});

  const [showListOnMobile, setShowListOnMobile] = useState(true);
  const [leftPeers, setLeftPeers] = useState<Set<string>>(new Set());
  const [desiredPeer, setDesiredPeer] = useState<string | undefined>(undefined);

  // Read ?thread on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const pid = sp.get('thread') || undefined;
      if (pid) {
        setDesiredPeer(pid);
        setShowListOnMobile(false);
      }
    }
  }, []);

  // Load hidden peers
  useEffect(() => {
    if (!me || typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(`hx_left_peers:${me}`);
      const parsed: string[] = raw ? JSON.parse(raw) : [];
      setLeftPeers(new Set(parsed));
    } catch {
      setLeftPeers(new Set());
    }
  }, [me]);

  const saveLeftPeers = useCallback(
    (next: Set<string>) => {
      if (!me || typeof window === 'undefined') return;
      try {
        localStorage.setItem(`hx_left_peers:${me}`, JSON.stringify([...next]));
      } catch {}
    },
    [me]
  );

  const handleLeaveChat = useCallback(
    (peerId: string) => {
      if (!peerId) return;
      const ok =
        typeof window !== 'undefined'
          ? window.confirm('Leave this chat? You will no longer see it in Messages on this device.')
          : true;
      if (!ok) return;

      setLeftPeers((prev) => {
        const next = new Set(prev);
        next.add(peerId);
        saveLeftPeers(next);
        return next;
      });

      if (selected?.peer_id === peerId) {
        setSelected(undefined);
        setShowListOnMobile(true);
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          url.searchParams.delete('thread');
          window.history.replaceState({}, '', url.toString());
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }

      setThreads((prev) => prev.filter((t) => t.peer_id !== peerId));
    },
    [saveLeftPeers, selected]
  );

  const setCache = useCallback(
    (peerId: string, next: ChatMsg[] | ((prev: ChatMsg[]) => ChatMsg[])) => {
      setMsgCache((prev) => {
        const prevArr = prev[peerId] || [];
        const arr = typeof next === 'function' ? (next as any)(prevArr) : next;
        return { ...prev, [peerId]: arr };
      });
    },
    []
  );

  // (Kept for parity with earlier version; not used by default path)
  const createPlaceholderOfferOwnedByMe = useCallback(
    async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from('offers')
        .insert([
          {
            owner_id: me,
            title: 'Direct message',
            offer_type: 'dm',
            is_online: true,
            city: null,
            country: null,
            images: [],
            status: 'archived',
          },
        ])
        .select('id')
        .single();
      if (error) return null;
      return (data as any)?.id ?? null;
    },
    [me]
  );

  // RLS-friendly counterpart used for deep-link synth
  const ensureRequestWithPeer = useCallback(
    async (
      uid: string,
      peerId: string
    ): Promise<{ request_id: string | null; offer_id: string | null; offer_title?: string } | null> => {
      // A) uid -> peer
      {
        const { data } = await supabase
          .from('requests')
          .select('id, offer_id, offers!inner(id, title, owner_id)')
          .eq('requester_profile_id', uid)
          .eq('offers.owner_id', peerId)
          .order('created_at', { ascending: false })
          .maybeSingle();

        if (data?.id) {
          const row: any = data;
          return { request_id: row.id, offer_id: row.offer_id ?? null, offer_title: row.offers?.title };
        }
      }

      // B) peer -> uid
      {
        const { data } = await supabase
          .from('requests')
          .select('id, offer_id, offers!inner(id, title, owner_id)')
          .eq('requester_profile_id', peerId)
          .eq('offers.owner_id', uid)
          .order('created_at', { ascending: false })
          .maybeSingle();

        if (data?.id) {
          const row: any = data;
          return { request_id: row.id, offer_id: row.offer_id ?? null, offer_title: row.offers?.title };
        }
      }

      // C) Anchor to peer's latest visible offer; requester = uid
      const { data: peerOffer } = await supabase
        .from('offers')
        .select('id, title')
        .eq('owner_id', peerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!peerOffer?.id) return { request_id: null, offer_id: null, offer_title: undefined };

      const { data: inserted, error: insErr } = await supabase
        .from('requests')
        .insert([{ offer_id: peerOffer.id, requester_profile_id: uid }])
        .select('id')
        .single();

      if (!insErr && inserted?.id) {
        return { request_id: inserted.id, offer_id: peerOffer.id, offer_title: (peerOffer as any).title };
      }
      return { request_id: null, offer_id: peerOffer.id, offer_title: (peerOffer as any).title };
    },
    []
  );

  // Build threads grouped by peer
  const buildThreads = useCallback(
    async (uid: string) => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, created_at, type, read_at, data')
        .eq('profile_id', uid)
        .or('type.eq.message,type.eq.message_received')
        .order('created_at', { ascending: false })
        .limit(800);
      if (error) throw error;

      type Agg = { last_at: string; last_text?: string; offer_id?: string; unread: number };
      const byReq = new Map<string, Agg>();

      for (const row of (data || []) as any[]) {
        const rid = row.data?.request_id as string | undefined;
        if (!rid) continue;
        const prev = byReq.get(rid);
        const isUnread = row.type === 'message_received' && !row.read_at;
        if (!prev) {
          byReq.set(rid, {
            last_at: row.created_at,
            last_text: (row.data?.text ?? row.data?.message) ?? '',
            offer_id: row.data?.offer_id,
            unread: isUnread ? 1 : 0,
          });
        } else {
          if (row.created_at > prev.last_at) {
            prev.last_at = row.created_at;
            prev.last_text = (row.data?.text ?? row.data?.message) ?? prev.last_text;
          }
          prev.unread += isUnread ? 1 : 0;
        }
      }

      const reqIds = Array.from(byReq.keys());

      let reqRows: any[] = [];
      if (reqIds.length > 0) {
        const { data: reqRowsData } = await supabase
          .from('requests')
          .select(`id, offer_id, requester_profile_id, offers!left ( id, title, owner_id )`)
          .in('id', reqIds);
        reqRows = (reqRowsData || []) as any[];
      }

      type PartialReq = {
        id: string;
        offer_id: string | null;
        owner_id: string | null;
        requester_id: string;
        title?: string;
      };

      const reqList: PartialReq[] = [];
      for (const r of reqRows) {
        reqList.push({
          id: r.id,
          offer_id: r.offer_id ?? null,
          owner_id: r.offers?.owner_id ?? null,
          requester_id: r.requester_profile_id,
          title: r.offers?.title,
        });
      }

      const byPeer = new Map<string, Thread>();

      for (const r of reqList) {
        if (!r.owner_id) continue;
        const peer_id = uid === r.owner_id ? r.requester_id : r.owner_id;
        const agg = byReq.get(r.id)!;

        const existing = byPeer.get(peer_id);
        if (!existing) {
          byPeer.set(peer_id, {
            peer_id,
            request_ids: [r.id],
            offer_ids: r.offer_id ? [r.offer_id] : [],
            offer_id: r.offer_id || '',
            offer_title: r.title,
            last_text: agg.last_text,
            last_at: agg.last_at,
            unread: agg.unread,
          });
        } else {
          existing.request_ids.push(r.id);
          if (r.offer_id) existing.offer_ids.push(r.offer_id);
          if (agg.last_at > existing.last_at) {
            existing.last_at = agg.last_at;
            existing.last_text = agg.last_text;
            if (r.offer_id) existing.offer_id = r.offer_id;
            existing.offer_title = r.title;
          }
          existing.unread += agg.unread;
        }
      }

      const peers = Array.from(byPeer.keys());
      if (peers.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', peers);

        const pmap = new Map<string, { name: string; avatar: string | null }>();
        for (const p of (profiles || []) as any[]) {
          pmap.set(p.id, { name: p.display_name || 'Someone', avatar: p.avatar_url ?? null });
        }

        for (const t of byPeer.values()) {
          const info = pmap.get(t.peer_id);
          if (info) {
            t.peer_name = info.name;
            t.peer_avatar = info.avatar;
          }
          t.request_ids.sort((a, b) => {
            const aa = byReq.get(a)!.last_at;
            const bb = byReq.get(b)!.last_at;
            return aa < bb ? 1 : -1;
          });
        }
      }

      let sorted = Array.from(byPeer.values()).sort((a, b) => (a.last_at < b.last_at ? 1 : -1));
      let filtered = sorted.filter((t) => !leftPeers.has(t.peer_id));

      // Deep-link synth if none exists yet
      if (desiredPeer && !filtered.some((t) => t.peer_id === desiredPeer)) {
        const ensured = await ensureRequestWithPeer(uid, desiredPeer);
        const { data: peerProfile } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .eq('id', desiredPeer)
          .limit(1)
          .maybeSingle();

        const peer_name = (peerProfile as any)?.display_name || 'Someone';
        const peer_avatar = (peerProfile as any)?.avatar_url ?? null;

        const now = new Date().toISOString();
        const newThread: Thread = {
          peer_id: desiredPeer,
          peer_name,
          peer_avatar,
          request_ids: ensured?.request_id ? [ensured.request_id] : [],
          offer_ids: ensured?.offer_id ? [ensured.offer_id] : [],
          offer_id: ensured?.offer_id || '',
          offer_title: ensured?.offer_title,
          last_text: '',
          last_at: now,
          unread: 0,
        };
        filtered = [newThread, ...filtered];
      }

      setThreads(filtered);

      // Selection preference: URL peer
      if (!selected) {
        if (desiredPeer) {
          const match = filtered.find((t) => t.peer_id === desiredPeer);
          if (match) {
            setSelected(match);
            setShowListOnMobile(false);
            if (typeof window !== 'undefined') {
              const url = new URL(window.location.href);
              url.searchParams.set('thread', desiredPeer);
              window.history.replaceState({}, '', url.toString());
            }
          } else if (filtered.length > 0) {
            setSelected(filtered[0]);
          }
        } else if (filtered.length > 0) {
          setSelected(filtered[0]);
        }
      } else if (!filtered.some((t) => t.peer_id === selected.peer_id)) {
        setSelected(undefined);
        setShowListOnMobile(true);
      }

      // Prefetch a few
      const toPrefetch = filtered.slice(0, 3);
      for (const t of toPrefetch) {
        if (msgCache[t.peer_id] || t.request_ids.length === 0) continue;
        const { data: m } = await supabase
          .from('notifications')
          .select('id, created_at, type, data')
          .eq('profile_id', uid)
          .or('type.eq.message,type.eq.message_received')
          .in('data->>request_id', t.request_ids)
          .order('created_at', { ascending: true });
        const mapped: ChatMsg[] = (m || []).map((row: any) => ({
          id: row.id,
          created_at: row.created_at,
          text: (row.data?.text ?? row.data?.message) ?? '',
          sender_id: row.data?.sender_id ?? '',
        }));
        setMsgCache((prev) => ({ ...prev, [t.peer_id]: mapped }));
      }
    },
    [msgCache, selected, leftPeers, desiredPeer, ensureRequestWithPeer]
  );

  useEffect(() => {
    if (!me) return;
    void buildThreads(me);
  }, [me, buildThreads]);

  const selectThread = useCallback((t: Thread) => {
    setSelected(t);
    setShowListOnMobile(false);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('thread', t.peer_id);
      window.history.replaceState({}, '', url.toString());
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const backToListMobile = useCallback(() => {
    setShowListOnMobile(true);
    setSelected(undefined);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('thread');
      window.history.replaceState({}, '', url.toString());
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const leftClasses = ['md:block', showListOnMobile ? 'block' : 'hidden md:block'].join(' ');
  const rightClasses = ['md:block md:flex-1', showListOnMobile ? 'hidden md:block' : 'block'].join(' ');

  return (
    <section className="md:flex md:gap-4">
      <div className={leftClasses}>
        <ThreadsList threads={threads} selectedPeer={selected?.peer_id} onSelect={selectThread} />
      </div>

      <div className={rightClasses}>
        <ChatPane
          me={me || ''}
          thread={selected}
          initialMsgs={selected ? msgCache[selected.peer_id] : undefined}
          onCache={setCache}
          onBackMobile={backToListMobile}
          onLeaveChat={handleLeaveChat}
        />
      </div>
    </section>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-600">Loading messages…</div>}>
      <MessagesContent />
    </Suspense>
  );
}
