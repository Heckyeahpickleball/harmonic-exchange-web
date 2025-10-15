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
  // person-to-person thread (merged across requests with this peer)
  peer_id: string;
  peer_name?: string;
  peer_avatar?: string | null;

  // all underlying requests with this peer (newest first)
  request_ids: string[];
  offer_ids: string[];

  // display helpers taken from the newest underlying request
  offer_id: string;
  offer_title?: string;

  // last activity/preview across all requests
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
  const s = size + 'px';
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
          <li className="px-3 py-3 text-sm text-gray-600">
            No conversations yet.
          </li>
        )}

        {threads.map((t) => {
          const active = selectedPeer === t.peer_id;
          return (
            <li
              key={t.peer_id}
              className={['cursor-pointer px-3 py-3 hover:bg-gray-50', active ? 'bg-gray-100' : ''].join(' ')}
              onClick={() => onSelect(t)}
            >
              <div className="flex items-center gap-3">
                <Avatar url={t.peer_avatar ?? null} alt={t.peer_name || 'Someone'} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">
                        {t.peer_name || 'Someone'}
                      </div>
                      <div className="truncate text-gray-700 text-[13px]">
                        {t.offer_title || '—'}
                      </div>
                      <div className="truncate text-xs text-gray-500">
                        {t.last_text || ''}
                      </div>
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
}: {
  me: string;
  thread?: Thread;
  initialMsgs?: ChatMsg[];
  onCache: (peerId: string, msgs: ChatMsg[] | ((prev: ChatMsg[]) => ChatMsg[])) => void;
  onBackMobile: () => void;
}) {
  const [msgs, setMsgs] = useState<ChatMsg[]>(initialMsgs ?? []);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [shared, setShared] = useState<SharedOffer[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMsgs(initialMsgs ?? []);
  }, [thread?.peer_id, initialMsgs]);

  const canSend = useMemo(
    () => !!thread && !!draft.trim() && !!me && !!thread.peer_id && thread.request_ids.length > 0,
    [thread, draft, me]
  );

  // Load/mark messages across ALL request_ids in this peer thread
  const reqCounter = useRef(0);
  const loadThread = useCallback(async () => {
    if (!thread) return;
    setErr(null);
    const myTurn = ++reqCounter.current;

    // Pull all notifications for any of the request_ids
    const { data, error } = await supabase
      .from('notifications')
      .select('id, created_at, type, data, read_at')
      .eq('profile_id', me)
      .or('type.eq.message,type.eq.message_received')
      .in('data->>request_id', thread.request_ids) // key change: merge across requests
      .order('created_at', { ascending: true });

    if (reqCounter.current !== myTurn) return;
    if (error) return setErr(error.message);

    const mapped: ChatMsg[] = (data || []).map((row: any) => ({
      id: row.id,
      created_at: row.created_at,
      text: (row.data?.text ?? row.data?.message) ?? '',
      sender_id: row.data?.sender_id ?? '',
    }));

    setMsgs(mapped);
    onCache(thread.peer_id, mapped);

    // mark all unread from this peer (across request_ids)
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('profile_id', me)
      .eq('type', 'message_received')
      .is('read_at', null)
      .in('data->>request_id', thread.request_ids);
  }, [me, thread, onCache]);

  // shared offers strip between the two users
  const loadSharedOffers = useCallback(async () => {
    if (!thread) return;
    try {
const ids = [me, thread.peer_id];

const { data, error } = await supabase
  .from('requests')
  .select(`
    id,
    offer_id,
    offers!inner (
      id,
      title,
      owner_id
    )
  `)
  // either I own the offer OR I'm the requester
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

  // realtime across all request_ids (filter by profile_id; guard in handler)
  useEffect(() => {
    if (!thread) return;
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

  // Send on the newest underlying request so new requests don't fork a new chat
  const handleSend = useCallback(async () => {
    if (!thread || !draft.trim() || thread.request_ids.length === 0) return;
    setErr(null);
    setSending(true);

    const text = draft.trim();
    const optimistic: ChatMsg = {
      id: `tmp-${Math.random().toString(36).slice(2)}`,
      created_at: new Date().toISOString(),
      text,
      sender_id: me,
    };
    setMsgs((m) => [...m, optimistic]);
    onCache(thread.peer_id, (prev) => [...(prev || []), optimistic]);
    setDraft('');

    try {
      const canonicalRequestId = thread.request_ids[0]; // newest
      const canonicalOfferId = thread.offer_id;

      const payload = { request_id: canonicalRequestId, offer_id: canonicalOfferId, sender_id: me, text };
      const now = new Date().toISOString();
      const { error } = await supabase.from('notifications').insert([
        { profile_id: me, type: 'message', data: payload, read_at: now },
        { profile_id: thread.peer_id, type: 'message_received', data: payload },
      ]);
      if (error) throw error;
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to send message.');
      setMsgs((m) => m.filter((x) => x.id !== optimistic.id));
      onCache(thread.peer_id, (prev) => (prev || []).filter((x) => x.id !== optimistic.id));
      setDraft(text);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [draft, me, thread, onCache]);

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
        {/* Header: Back (mobile) + peer + shared offers */}
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
                <div className="truncate font-semibold">
                  {thread.offer_title || '—'}
                </div>
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
            </div>
          </div>

          {/* Mobile action (profile) */}
          <div className="flex justify-end gap-2 px-3 pb-2 md:hidden">
            <a className="rounded border px-2 py-1 text-xs hover:bg-gray-50" href={`/u/${thread.peer_id}`}>
              View profile
            </a>
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
        <div className="max-h-[55vh] min-h-[45vh] overflow-auto p-3">
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

  // purely for mobile show/hide of the list; CSS handles desktop
  const [showListOnMobile, setShowListOnMobile] = useState(true);

  // Read ?thread (peer id) once on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const pid = sp.get('thread');
      if (pid) setShowListOnMobile(false);
    }
  }, []);

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

  // Build peer-grouped threads
  const buildThreads = useCallback(
    async (uid: string) => {
      // 1) pull all message notifications for me
      const { data, error } = await supabase
        .from('notifications')
        .select('id, created_at, type, read_at, data')
        .eq('profile_id', uid)
        .or('type.eq.message,type.eq.message_received')
        .order('created_at', { ascending: false })
        .limit(800);
      if (error) throw error;

      // Aggregate by request first (to compute per-request last activity/unread)
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
      if (reqIds.length === 0) {
        setThreads([]);
        setSelected(undefined);
        setShowListOnMobile(true);
        return;
      }

      // 2) join requests to learn each request's owner/requester and offer title
      const { data: reqRows } = await supabase
        .from('requests')
        .select(`id, offer_id, requester_profile_id, offers!inner ( id, title, owner_id )`)
        .in('id', reqIds);

      type PartialReq = {
        id: string;
        offer_id: string;
        owner_id: string;
        requester_id: string;
        title?: string;
      };

      const reqList: PartialReq[] = [];
      for (const r of (reqRows || []) as any[]) {
        reqList.push({
          id: r.id,
          offer_id: r.offer_id,
          owner_id: r.offers?.owner_id,
          requester_id: r.requester_profile_id,
          title: r.offers?.title,
        });
      }

      // 3) group requests by peer (other person)
      const byPeer = new Map<string, Thread>();

      for (const r of reqList) {
        const peer_id = uid === r.owner_id ? r.requester_id : r.owner_id;
        const agg = byReq.get(r.id)!;

        const existing = byPeer.get(peer_id);
        if (!existing) {
          byPeer.set(peer_id, {
            peer_id,
            request_ids: [r.id],
            offer_ids: [r.offer_id],
            offer_id: r.offer_id,
            offer_title: r.title,
            last_text: agg.last_text,
            last_at: agg.last_at,
            unread: agg.unread,
          });
        } else {
          // push and keep newest-first ordering of request_ids
          existing.request_ids.push(r.id);
          existing.offer_ids.push(r.offer_id);
          // Update "display" fields if this request is newer
          if (agg.last_at > existing.last_at) {
            existing.last_at = agg.last_at;
            existing.last_text = agg.last_text;
            existing.offer_id = r.offer_id;
            existing.offer_title = r.title;
          }
          existing.unread += agg.unread;
        }
      }

      // 4) hydrate peer names/avatars
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
          // newest-first for request_ids
          t.request_ids.sort((a, b) => {
            const aa = byReq.get(a)!.last_at;
            const bb = byReq.get(b)!.last_at;
            return aa < bb ? 1 : -1;
          });
        }
      }

      const sorted = Array.from(byPeer.values()).sort((a, b) => (a.last_at < b.last_at ? 1 : -1));
      setThreads(sorted);

      // Desktop: auto-select first thread if none picked
      if (!selected && sorted.length > 0) {
        setSelected(sorted[0]);
      }

      // Prefetch first few peer threads into cache
      const toPrefetch = sorted.slice(0, 3);
      for (const t of toPrefetch) {
        if (msgCache[t.peer_id]) continue;
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
    [msgCache, selected]
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
      url.searchParams.set('thread', t.peer_id); // store peer_id in URL
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
        <ThreadsList
          threads={threads}
          selectedPeer={selected?.peer_id}
          onSelect={selectThread}
        />
      </div>

      <div className={rightClasses}>
        <ChatPane
          me={me || ''}
          thread={selected}
          initialMsgs={selected ? msgCache[selected.peer_id] : undefined}
          onCache={setCache}
          onBackMobile={backToListMobile}
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
