// /app/messages/page.tsx
'use client';

import {
  Suspense,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

type ChatMsg = {
  id: string;            // notifications.id (your row)
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

/* ---------- right column ---------- */
function ChatPane({ me, thread }: { me: string; thread?: Thread }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

  // realtime updates for this thread
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
      inputRef.current?.focus();
    }
  }, [draft, me, thread]);

  // Delete just your copy (your notifications row)
  const deleteMsg = useCallback(
    async (msgId: string) => {
      try {
        await supabase.from('notifications').delete().eq('id', msgId).eq('profile_id', me);
        setMsgs((m) => m.filter((x) => x.id !== msgId));
      } catch {
        /* non-fatal */
      }
    },
    [me]
  );

  // Shift+Enter inserts newline at caret
  const insertNewlineAtCursor = useCallback(() => {
    const el = inputRef.current;
    if (!el) {
      setDraft((v) => v + '\n');
      return;
    }
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
          <Link className="text-xs underline" href={`/offers/${thread.offer_id}`}>
            View offer
          </Link>
        </div>

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
                {/* Delete (your copy only) */}
                <button
                  aria-label="Delete message"
                  title="Delete message"
                  onClick={() => deleteMsg(m.id)}
                  className={`absolute right-1 top-1 hidden rounded px-1 text-[11px] ${
                    mine
                      ? 'group-hover:inline-block bg-white/10 hover:bg-white/20'
                      : 'group-hover:inline-block bg-black/5 hover:bg-black/10'
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
                  if (e.shiftKey) {
                    e.preventDefault();
                    insertNewlineAtCursor();
                  } else {
                    e.preventDefault();
                    if (!sending) void handleSend();
                  }
                }
              }}
              rows={2}
              placeholder="Type a message…"
              className="flex-1 resize-none rounded border px-3 py-2 text-sm"
              aria-label="Type a message"
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
          <div className="mt-1 text-[11px] text-gray-500">
            Press <kbd>Enter</kbd> to send • <kbd>Shift</kbd>+<kbd>Enter</kbd> for a new line
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- page shell ---------- */
function MessagesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const me = useMe();

  const [threads, setThreads] = useState<Thread[]>([]);
  const [selected, setSelected] = useState<Thread | undefined>(undefined);

  const buildThreads = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, created_at, type, read_at, data')
      .eq('profile_id', uid)
      .or('type.eq.message,type.eq.message_received')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) throw error;

    const byReq = new Map<
      string,
      {
        last_at: string;
        last_text?: string;
        offer_id?: string;
        offer_title?: string;
        unread: number;
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

    const { data: reqRows } = await supabase
      .from('requests')
      .select(`
        id,
        offer_id,
        requester_profile_id,
        offers!inner ( id, title, owner_id )
      `)
      .in('id', reqIds);

    const tmp: Thread[] = [];

    for (const r of (reqRows || []) as any[]) {
      const agg = byReq.get(r.id);
      if (!agg) continue;

      const offer_id = r.offer_id as string;
      const offer_title = agg.offer_title ?? (r.offers?.title as string | undefined);
      const owner_id = r.offers?.owner_id as string;
      const requester_id = r.requester_profile_id as string;

      const uidIsOwner = uid === owner_id;
      const peer_id = uidIsOwner ? requester_id : owner_id;

      tmp.push({
        request_id: r.id as string,
        offer_id,
        offer_title,
        peer_id,
        peer_name: undefined,
        last_text: agg.last_text,
        last_at: agg.last_at,
        unread: agg.unread,
      });
    }

    const peerIds = Array.from(new Set(tmp.map((t) => t.peer_id)));
    const { data: peers } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', peerIds);

    const nameMap = new Map<string, string>();
    for (const p of (peers || []) as any[]) nameMap.set(p.id, p.display_name || 'Someone');

    const builtSorted = tmp
      .map((t) => ({ ...t, peer_name: nameMap.get(t.peer_id) || t.peer_name }))
      .sort((a, b) => (a.last_at < b.last_at ? 1 : -1));

    setThreads(builtSorted);
  }, []);

  // fetch thread list
  useEffect(() => {
    if (!me) return;
    void buildThreads(me);
  }, [me, buildThreads]);

  // choose which thread is selected whenever threads or the URL param changes
  useEffect(() => {
    if (threads.length === 0) {
      setSelected(undefined);
      return;
    }
    const fromUrl = searchParams.get('thread');
    if (fromUrl) {
      const found = threads.find((t) => t.request_id === fromUrl);
      if (found && found.request_id !== selected?.request_id) {
        setSelected(found);
      }
    } else if (!selected) {
      setSelected(threads[0]);
    }
  }, [threads, searchParams, selected]);

  return (
    <section className="flex gap-4">
      <ThreadsList
        threads={threads}
        selected={selected?.request_id}
        onSelect={(t) => {
          setSelected(t); // update immediately for snappy UI
          const sp = new URLSearchParams(Array.from(searchParams.entries()));
          sp.set('thread', t.request_id);
          const url = `${pathname}?${sp.toString()}`;
          // keep URL in sync without a full navigation
          router.replace(url);
        }}
      />
      <ChatPane me={me || ''} thread={selected} />
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
