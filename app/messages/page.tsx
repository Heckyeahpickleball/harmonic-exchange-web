// File: app/messages/page.tsx
'use client';

import { Suspense, useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

type ChatMsg = {
  id: string;
  created_at: string;
  text: string;
  sender_id: string;
};

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

function formatTS(ts: string) {
  return new Date(ts).toLocaleString();
}

function useMe() {
  const [me, setMe] = useState<string | null>(null);
  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getUser();
      setMe(data?.user?.id ?? null);
    })();
  }, []);
  return me;
}

function ThreadsList({
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
                  <div className="truncate font-semibold">
                    {t.peer_name || 'Someone'}
                  </div>
                  <div className="truncate text-gray-700">
                    {t.offer_title || '—'}
                  </div>
                  <div className="truncate text-xs text-gray-500">
                    {t.last_text || ''}
                  </div>
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
}

function ChatPane({
  me,
  thread,
}: {
  me: string;
  thread?: Thread;
}) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canSend = useMemo(
    () => !!thread && !!draft.trim() && !!me && !!thread.peer_id,
    [thread, draft, me]
  );

  const loadThread = useCallback(async () => {
    if (!thread) return;
    setErr(null);
    const { data, error } = await supabase
      .from('notifications')
      .select('id, created_at, type, data')
      .eq('profile_id', me)
      .or('type.eq.message,type.eq.message_received')
      .contains('data', { request_id: thread.request_id })
      .order('created_at', { ascending: true });

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

    // mark incoming messages for this thread as read
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('profile_id', me)
      .eq('type', 'message_received')
      .is('read_at', null)
      .contains('data', { request_id: thread.request_id });
  }, [me, thread]);

  useEffect(() => {
    void loadThread();
  }, [loadThread]);

  // realtime updates
  useEffect(() => {
    if (!thread) return;
    const ch = supabase
      .channel(`realtime:messages:${thread.request_id}:${me}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `profile_id=eq.${me}`,
        },
        (payload) => {
          const n = payload.new as any;
          if (
            (n.type === 'message' || n.type === 'message_received') &&
            n?.data?.request_id === thread.request_id
          ) {
            const msg: ChatMsg = {
              id: n.id,
              created_at: n.created_at,
              text: (n.data?.text ?? n.data?.message) ?? '',
              sender_id: n.data?.sender_id ?? '',
            };
            setMsgs((m) => [...m, msg]);

            // auto-mark read if it’s an incoming one
            if (n.type === 'message_received') {
              void supabase
                .from('notifications')
                .update({ read_at: new Date().toISOString() })
                .eq('id', n.id);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [me, thread]);

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
    setDraft('');

    try {
      const payload = {
        request_id: thread.request_id,
        offer_id: thread.offer_id,
        sender_id: me,
        text,
      };
      const now = new Date().toISOString();

      const { error } = await supabase.from('notifications').insert([
        { profile_id: me, type: 'message', data: payload, read_at: now },
        { profile_id: thread.peer_id, type: 'message_received', data: payload },
      ]);
      if (error) throw error;
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to send message.');
      // revert optimistic
      setMsgs((m) => m.filter((x) => x.id !== optimistic.id));
      setDraft(text);
    } finally {
      setSending(false);
    }
  }, [draft, me, thread]);

  if (!thread) {
    return (
      <div className="flex-1">
        <div className="rounded border p-6 text-sm text-gray-600">
          Select a conversation on the left to start chatting.
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1">
      <div className="rounded border">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <div className="min-w-0">
            <div className="truncate text-sm text-gray-600">
              Chat with {thread.peer_name || 'Someone'}
            </div>
            <div className="truncate font-semibold">
              {thread.offer_title || '—'}
            </div>
          </div>
          <Link
            className="text-xs underline"
            href={`/offers/${thread.offer_id}`}
          >
            View offer
          </Link>
        </div>

        <div className="max-h-[55vh] min-h-[45vh] overflow-auto p-3">
          {msgs.map((m) => {
            const mine = m.sender_id === me;
            return (
              <div
                key={m.id}
                className={`mb-2 max-w-[85%] rounded px-3 py-2 text-sm ${
                  mine ? 'ml-auto bg-black text-white' : 'bg-gray-100'
                }`}
              >
                <div className="text-[11px] opacity-70">{formatTS(m.created_at)}</div>
                <div className="mt-1 whitespace-pre-wrap">{m.text}</div>
              </div>
            );
          })}
        </div>

        <div className="border-t p-3">
          {err && <div className="mb-2 text-sm text-red-600">{err}</div>}
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!sending) void handleSend();
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type a message…"
              className="flex-1 rounded border px-3 py-2 text-sm"
            />
            <button
              type="submit"
              onClick={() => {
                if (!sending) void handleSend();
              }}
              disabled={!canSend || sending}
              className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-60"
            >
              {sending ? 'Sending…' : 'Send'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function MessagesContent() {
  const searchParams = useSearchParams();
  const me = useMe();

  const [threads, setThreads] = useState<Thread[]>([]);
  const [selected, setSelected] = useState<Thread | undefined>(undefined);

  // hydrate selection from ?thread=
  useEffect(() => {
    const th = searchParams.get('thread') || undefined;
    if (th) {
      // set later when threads load
      setSelected((prev) => (prev && prev.request_id === th ? prev : undefined));
    }
  }, [searchParams]);

  const buildThreads = useCallback(
    async (uid: string) => {
      // pull my message notifications
      const { data, error } = await supabase
        .from('notifications')
        .select('id, created_at, type, read_at, data')
        .eq('profile_id', uid)
        .or('type.eq.message,type.eq.message_received')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      // group by request_id
      const byReq = new Map<
        string,
        {
          last_at: string;
          last_text?: string;
          offer_id?: string;
          offer_title?: string;
          unread: number;
          sender_id?: string;
        }
      >();

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
            offer_title: row.data?.offer_title,
            unread: isUnread ? 1 : 0,
            sender_id: row.data?.sender_id ?? undefined,
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
        return;
      }

      // fetch request → to derive peer_id (other participant) and offer_id/title if missing
      const { data: reqRows } = await supabase
        .from('requests')
        .select(`
          id,
          offer_id,
          requester_profile_id,
          offers!inner ( id, title, owner_id )
        `)
        .in('id', reqIds);

      const threadsBuilt: Thread[] = [];

      for (const r of (reqRows || []) as any[]) {
        const agg = byReq.get(r.id);
        if (!agg) continue;

        const offer_id = r.offer_id as string;
        const offer_title = agg.offer_title ?? (r.offers?.title as string | undefined);
        const owner_id = r.offers?.owner_id as string;
        const requester_id = r.requester_profile_id as string;

        const peer_id = uid === owner_id ? requester_id : owner_id;

        threadsBuilt.push({
          request_id: r.id as string,
          offer_id,
          offer_title,
          peer_id,
          peer_name: undefined, // fill next step
          last_text: agg.last_text,
          last_at: agg.last_at,
          unread: agg.unread,
        });
      }

      // fetch peer names in one go
      const peerIds = Array.from(new Set(threadsBuilt.map((t) => t.peer_id)));
      const { data: peers } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', peerIds);

      const nameMap = new Map<string, string>();
      for (const p of (peers || []) as any[]) {
        nameMap.set(p.id, p.display_name || 'Someone');
      }

      setThreads(
        threadsBuilt
          .map((t) => ({ ...t, peer_name: nameMap.get(t.peer_id) || t.peer_name }))
          .sort((a, b) => (a.last_at < b.last_at ? 1 : -1))
      );

      // set selection if query param present
      const want = searchParams.get('thread');
      if (want) {
        const found = threadsBuilt.find((t) => t.request_id === want);
        if (found) setSelected(found);
      } else if (!selected && threadsBuilt.length > 0) {
        setSelected(threadsBuilt[0]);
      }
    },
    [searchParams, selected]
  );

  // initial & refresh when me changes
  useEffect(() => {
    if (!me) return;
    void buildThreads(me);
  }, [me, buildThreads]);

  // realtime: refresh thread list when a new notification arrives for me
  useEffect(() => {
    if (!me) return;
    const ch = supabase
      .channel('realtime:threads:listener')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `profile_id=eq.${me}`,
        },
        () => {
          void buildThreads(me);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [me, buildThreads]);

  return (
    <section className="flex gap-4">
      <ThreadsList
        threads={threads}
        selected={selected?.request_id}
        onSelect={(t) => setSelected(t)}
      />
      <ChatPane me={me || ''} thread={selected} />
    </section>
  );
}

// Page wrapper (Suspense for Next.js 15 + useSearchParams)
export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="p-4 text-sm text-gray-600">Loading messages…</div>
      }
    >
      <MessagesContent />
    </Suspense>
  );
}
