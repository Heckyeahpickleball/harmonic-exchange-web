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
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

type ChatMsg = { id: string; created_at: string; text: string; sender_id: string };
type Thread = {
  request_id: string;
  offer_id: string;
  offer_title?: string;
  peer_id: string;
  peer_name?: string;
  last_text?: string;
  last_at: string;
  unread: number;
};

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

/* ---------- left column ---------- */
const ThreadsList = memo(function ThreadsList({
  threads,
  selected,
  onSelect,
}: {
  threads: Thread[];
  selected?: string;
  onSelect: (t: Thread) => void;
}) {
  return (
    <aside className="w-72 shrink-0">
      <h2 className="mb-3 text-xl font-bold">Messages</h2>
      <ul className="rounded border">
        {threads.length === 0 && (
          <li className="px-3 py-3 text-sm text-gray-600">No conversations yet.</li>
        )}
        {threads.map((t) => {
          const active = selected === t.request_id;
          return (
            <li
              key={t.request_id}
              className={`cursor-pointer border-b px-3 py-3 text-sm hover:bg-gray-50 ${
                active ? 'bg-gray-100' : ''
              }`}
              onClick={() => onSelect(t)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{t.peer_name || 'Someone'}</div>
                  <div className="truncate text-gray-700">{t.offer_title || '—'}</div>
                  <div className="truncate text-xs text-gray-500">{t.last_text || ''}</div>
                </div>
                <div className="text-right">
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
            </li>
          );
        })}
      </ul>
    </aside>
  );
});

/* ---------- right column ---------- */
function ChatPane({
  me,
  thread,
  initialMsgs,
  onCache,
  onLeave,
}: {
  me: string;
  thread?: Thread;
  initialMsgs?: ChatMsg[];
  onCache: (rid: string, msgs: ChatMsg[] | ((prev: ChatMsg[]) => ChatMsg[])) => void;
  onLeave: (rid: string) => void;
}) {
  const router = useRouter();
  const [msgs, setMsgs] = useState<ChatMsg[]>(initialMsgs ?? []);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMsgs(initialMsgs ?? []);
  }, [thread?.request_id, initialMsgs]);

  const canSend = useMemo(
    () => !!thread && !!draft.trim() && !!me && !!thread.peer_id,
    [thread, draft, me]
  );

  // cancel stale fetches if user switches threads quickly
  const reqCounter = useRef(0);
  const loadThread = useCallback(async () => {
    if (!thread) return;
    setErr(null);
    const myTurn = ++reqCounter.current;

    const { data, error } = await supabase
      .from('notifications')
      .select('id, created_at, type, data')
      .eq('profile_id', me)
      .or('type.eq.message,type.eq.message_received')
      .contains('data', { request_id: thread.request_id })
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
    onCache(thread.request_id, mapped);

    // mark incoming messages read
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('profile_id', me)
      .eq('type', 'message_received')
      .is('read_at', null)
      .contains('data', { request_id: thread.request_id });
  }, [me, thread, onCache]);

  useEffect(() => {
    void loadThread();
  }, [loadThread]);

  useEffect(() => {
    if (!thread) return;
    const ch = supabase
      .channel(`realtime:messages:${thread.request_id}:${me}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `profile_id=eq.${me}` },
        (payload) => {
          const n = payload.new as any;
          if ((n.type === 'message' || n.type === 'message_received') && n?.data?.request_id === thread.request_id) {
            const msg: ChatMsg = {
              id: n.id,
              created_at: n.created_at,
              text: (n.data?.text ?? n.data?.message) ?? '',
              sender_id: n.data?.sender_id ?? '',
            };
            setMsgs((m) => [...m, msg]);
            onCache(thread.request_id, (prev) => [...(prev || []), msg]);

            if (n.type === 'message_received') {
              void supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [me, thread, onCache]);

  const handleSend = useCallback(async () => {
    if (!thread || !draft.trim()) return;
    setSending(true);
    setErr(null);

    const text = draft.trim();
    const optimistic: ChatMsg = {
      id: `tmp-${Math.random().toString(36).slice(2)}`,
      created_at: new Date().toISOString(),
      text,
      sender_id: me,
    };
    setMsgs((m) => [...m, optimistic]);
    onCache(thread.request_id, (prev) => [...(prev || []), optimistic]);
    setDraft('');

    try {
      const payload = { request_id: thread.request_id, offer_id: thread.offer_id, sender_id: me, text };
      const now = new Date().toISOString();
      const { error } = await supabase.from('notifications').insert([
        { profile_id: me, type: 'message', data: payload, read_at: now },
        { profile_id: thread.peer_id, type: 'message_received', data: payload },
      ]);
      if (error) throw error;
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to send message.');
      setMsgs((m) => m.filter((x) => x.id !== optimistic.id));
      onCache(thread.request_id, (prev) => (prev || []).filter((x) => x.id !== optimistic.id));
      setDraft(text);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [draft, me, thread, onCache]);

  const deleteMsg = useCallback(
    async (msgId: string) => {
      if (!thread) return;
      try {
        await supabase.from('notifications').delete().eq('id', msgId).eq('profile_id', me);
        setMsgs((m) => m.filter((x) => x.id !== msgId));
        onCache(thread.request_id, (prev) => (prev || []).filter((x) => x.id !== msgId));
      } catch {}
    },
    [me, thread, onCache]
  );

  const leaveChat = useCallback(async () => {
    if (!thread) return;
    const ok = confirm('Leave this conversation? This removes it from your inbox (does not affect the other person).');
    if (!ok) return;
    // delete ONLY your rows for this request_id
    await supabase
      .from('notifications')
      .delete()
      .eq('profile_id', me)
      .contains('data', { request_id: thread.request_id });

    onLeave(thread.request_id);
  }, [me, thread, onLeave]);

  const insertNewlineAtCursor = useCallback(() => {
    const el = inputRef.current;
    if (!el) return setDraft((v) => v + '\n');
    const start = el.selectionStart ?? draft.length;
    const end = el.selectionEnd ?? draft.length;
    const nextVal = draft.slice(0, start) + '\n' + draft.slice(end);
    setDraft(nextVal);
    requestAnimationFrame(() => {
      const pos = start + 1;
      if (inputRef.current) {
        inputRef.current.selectionStart = pos;
        inputRef.current.selectionEnd = pos;
      }
    });
  }, [draft]);

  if (!thread) {
    return (
      <div className="flex-1">
        <div className="rounded border p-6 text-sm text-gray-600">Select a conversation on the left to start chatting.</div>
      </div>
    );
  }

  return (
    <div className="flex-1">
      <div className="rounded border">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <div className="min-w-0">
            <div className="truncate text-sm text-gray-600">Chat with {thread.peer_name || 'Someone'}</div>
            <div className="truncate font-semibold">{thread.offer_title || '—'}</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
              onClick={() => router.push(`/offers/${thread.offer_id}`)}
              title="View Offer"
            >
              View offer
            </button>
            <button
              type="button"
              className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
              onClick={leaveChat}
              title="Leave chat"
            >
              Leave chat
            </button>
          </div>
        </div>

        <div className="max-h-[55vh] min-h-[45vh] overflow-auto p-3">
          {msgs.map((m) => {
            const mine = m.sender_id === me;
            return (
              <div key={m.id} className={`group relative mb-2 max-w-[85%] rounded px-3 py-2 text-sm ${mine ? 'ml-auto bg-black text-white' : 'bg-gray-100'}`}>
                <button
                  aria-label="Delete message"
                  title="Delete message"
                  onClick={() => deleteMsg(m.id)}
                  className={`absolute right-1 top-1 hidden rounded px-1 text-[11px] ${
                    mine ? 'group-hover:inline-block bg-white/10 hover:bg-white/20' : 'group-hover:inline-block bg-black/5 hover:bg-black/10'
                  }`}
                >
                  🗑
                </button>
                <div className="text-[11px] opacity-70">{formatTS(m.created_at)}</div>
                <div className="mt-1 whitespace-pre-wrap">{m.text}</div>
              </div>
            );
          })}
        </div>

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
                if (e.key === 'Enter') {
                  if (e.shiftKey) { e.preventDefault(); insertNewlineAtCursor(); }
                  else { e.preventDefault(); if (!sending) void handleSend(); }
                }
              }}
              rows={2}
              placeholder="Type a message…"
              className="flex-1 resize-none rounded border px-3 py-2 text-sm"
              aria-label="Type a message"
            />
            <button type="submit" disabled={sending || !canSend} className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-60">
              {sending ? 'Sending…' : 'Send'}
            </button>
          </form>
          <div className="mt-1 text-[11px] text-gray-500">Press <kbd>Enter</kbd> to send • <kbd>Shift</kbd>+<kbd>Enter</kbd> for a new line</div>
        </div>
      </div>
    </div>
  );
}

/* ---------- page shell ---------- */
function MessagesContent() {
  const me = useMe();

  const [threads, setThreads] = useState<Thread[]>([]);
  const [selected, setSelected] = useState<Thread | undefined>(undefined);
  const [msgCache, setMsgCache] = useState<Record<string, ChatMsg[]>>({});
  const [initialThreadId, setInitialThreadId] = useState<string | null>(null);

  // Read ?thread= once on mount (deep link), then ignore URL changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      setInitialThreadId(sp.get('thread'));
    }
  }, []);

  const setCache = useCallback((rid: string, next: ChatMsg[] | ((prev: ChatMsg[]) => ChatMsg[])) => {
    setMsgCache((prev) => {
      const prevArr = prev[rid] || [];
      const arr = typeof next === 'function' ? (next as any)(prevArr) : next;
      return { ...prev, [rid]: arr };
    });
  }, []);

  const buildThreads = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, created_at, type, read_at, data')
      .eq('profile_id', uid)
      .or('type.eq.message,type.eq.message_received')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) throw error;

    const byReq = new Map<string, { last_at: string; last_text?: string; offer_id?: string; offer_title?: string; unread: number }>();
    for (const row of (data || []) as any[]) {
      const rid = row.data?.request_id as string | undefined;
      if (!rid) continue;
      const prev = byReq.get(rid);
      const isUnread = row.type === 'message_received' && !row.read_at;
      if (!prev) {
        byReq.set(rid, { last_at: row.created_at, last_text: (row.data?.text ?? row.data?.message) ?? '', offer_id: row.data?.offer_id, offer_title: row.data?.offer_title, unread: isUnread ? 1 : 0 });
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
      return;
    }

    const { data: reqRows } = await supabase
      .from('requests')
      .select(`id, offer_id, requester_profile_id, offers!inner ( id, title, owner_id )`)
      .in('id', reqIds);

    const tmp: Thread[] = [];
    for (const r of (reqRows || []) as any[]) {
      const agg = byReq.get(r.id); if (!agg) continue;
      const owner_id = r.offers?.owner_id as string;
      const requester_id = r.requester_profile_id as string;
      const peer_id = uid === owner_id ? requester_id : owner_id;
      tmp.push({ request_id: r.id as string, offer_id: r.offer_id as string, offer_title: agg.offer_title ?? (r.offers?.title as string | undefined), peer_id, peer_name: undefined, last_text: agg.last_text, last_at: agg.last_at, unread: agg.unread });
    }

    const peerIds = Array.from(new Set(tmp.map((t) => t.peer_id)));
    const { data: peers } = await supabase.from('profiles').select('id, display_name').in('id', peerIds);
    const nameMap = new Map<string, string>(); for (const p of (peers || []) as any[]) nameMap.set(p.id, p.display_name || 'Someone');

    const builtSorted = tmp.map((t) => ({ ...t, peer_name: nameMap.get(t.peer_id) || t.peer_name })).sort((a, b) => (a.last_at < b.last_at ? 1 : -1));
    setThreads(builtSorted);

    // Prefetch first 3 threads
    const toPrefetch = builtSorted.slice(0, 3).map((t) => t.request_id);
    for (const rid of toPrefetch) {
      if (msgCache[rid]) continue;
      const { data: m } = await supabase
        .from('notifications')
        .select('id, created_at, type, data')
        .eq('profile_id', uid)
        .or('type.eq.message,type.eq.message_received')
        .contains('data', { request_id: rid })
        .order('created_at', { ascending: true });
      const mapped: ChatMsg[] = (m || []).map((row: any) => ({
        id: row.id,
        created_at: row.created_at,
        text: (row.data?.text ?? row.data?.message) ?? '',
        sender_id: row.data?.sender_id ?? '',
      }));
      setMsgCache((prev) => ({ ...prev, [rid]: mapped }));
    }
  }, [msgCache]);

  useEffect(() => {
    if (!me) return;
    void buildThreads(me);
  }, [me, buildThreads]);

  // Pick selected based on initial ?thread= (once), else first thread
  useEffect(() => {
    if (threads.length === 0) { setSelected(undefined); return; }
    if (initialThreadId) {
      const found = threads.find((t) => t.request_id === initialThreadId);
      setSelected(found || threads[0]);
      setInitialThreadId(null); // only apply once
    } else if (!selected) {
      setSelected(threads[0]);
    }
  }, [threads, initialThreadId, selected]);

  const selectThread = useCallback((t: Thread) => {
    setSelected(t);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('thread', t.request_id);
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  const leaveThread = useCallback((rid: string) => {
    setThreads((prev) => prev.filter((t) => t.request_id !== rid));
    setMsgCache((prev) => {
      const { [rid]: _, ...rest } = prev;
      return rest;
    });
    setSelected((prev) => {
      if (!prev || prev.request_id !== rid) return prev;
      // pick next available thread
      const next = threads.find((t) => t.request_id !== rid);
      return next;
    });
    // also clear ?thread= if it matched
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.get('thread') === rid) {
        url.searchParams.delete('thread');
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, [threads]);

  return (
    <section className="flex gap-4">
      <ThreadsList
        threads={threads}
        selected={selected?.request_id}
        onSelect={selectThread}
      />
      <ChatPane
        me={me || ''}
        thread={selected}
        initialMsgs={selected ? msgCache[selected.request_id] : undefined}
        onCache={setCache}
        onLeave={leaveThread}
      />
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
