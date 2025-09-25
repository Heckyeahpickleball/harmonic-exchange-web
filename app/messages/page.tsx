// File: app/messages/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Status = 'pending' | 'accepted' | 'declined' | 'withdrawn' | 'fulfilled';

type ReqRow = {
  id: string;
  offer_id: string;
  requester_profile_id: string;
  status: Status;
  created_at: string;
  offers?: { id: string; title: string; owner_id: string };
  requester?: { id: string; display_name: string | null };
};

type ChatMsg = {
  id: string;
  created_at: string;
  text: string;
  sender_id: string;
};

type ThreadItem = {
  request_id: string;
  last_at: string;
  last_text: string;
  unread: number;
  offer_id: string;
  offer_title?: string;
  peer_id: string;
  peer_name?: string;
  isOwner: boolean;
};

function ChatWindow({
  request,
  me,
  peerName,
  onNewActivity,
}: {
  request: ReqRow;
  me: string;
  peerName?: string;
  onNewActivity?: () => void;
}) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const otherId = request.offers?.owner_id === me ? request.requester_profile_id : (request.offers?.owner_id || '');

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, created_at, type, data, read_at')
        .eq('profile_id', me)
        .or('type.eq.message,type.eq.message_received')
        .contains('data', { request_id: request.id })
        .order('created_at', { ascending: true });
      if (error) throw error;

      const mapped: ChatMsg[] = (data || []).map((row: any) => ({
        id: row.id,
        created_at: row.created_at,
        text: (row.data?.text ?? row.data?.message) ?? '',
        sender_id: row.data?.sender_id ?? '',
      }));
      setMsgs(mapped);

      // mark any incoming unread as read
      const unreadIds = (data || [])
        .filter((r: any) => r.type === 'message_received' && !r.read_at)
        .map((r: any) => r.id as string);
      if (unreadIds.length) {
        await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', unreadIds);
        onNewActivity?.();
      }
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? 'Failed to load messages.');
    } finally {
      setLoading(false);
    }
  }, [me, request.id, onNewActivity]);

  useEffect(() => {
    load();
  }, [load]);

  // realtime: keep conversation live
  useEffect(() => {
    const ch = supabase
      .channel(`rt:messages:${request.id}:${me}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `profile_id=eq.${me}` },
        async (payload) => {
          const n = payload.new as any;
          if ((n.type === 'message' || n.type === 'message_received') && n?.data?.request_id === request.id) {
            const msg: ChatMsg = {
              id: n.id,
              created_at: n.created_at,
              text: (n.data?.text ?? n.data?.message) ?? '',
              sender_id: n.data?.sender_id ?? '',
            };
            setMsgs((prev) => [...prev, msg]);
            if (n.type === 'message_received' && !n.read_at) {
              await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id);
              onNewActivity?.();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [me, request.id, onNewActivity]);

  async function send() {
    const text = draft.trim();
    if (!text || !otherId) return;

    setDraft('');
    const optimistic: ChatMsg = {
      id: `tmp-${Math.random().toString(36).slice(2)}`,
      created_at: new Date().toISOString(),
      text,
      sender_id: me,
    };
    setMsgs((m) => [...m, optimistic]);

    try {
      const payload = { request_id: request.id, offer_id: request.offer_id, sender_id: me, text };
      const now = new Date().toISOString();

      const { error } = await supabase.from('notifications').insert([
        { profile_id: me, type: 'message', data: payload, read_at: now },
        { profile_id: otherId, type: 'message_received', data: payload },
      ]);
      if (error) throw error;
      onNewActivity?.();
      await load();
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? 'Failed to send message.');
      setDraft(text);
      setMsgs((m) => m.filter((x) => x.id !== optimistic.id));
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-3">
        <div className="text-sm text-gray-600">Chat with {peerName || 'participant'}</div>
        <div className="font-semibold">{request.offers?.title ?? 'Conversation'}</div>
      </div>

      <div className="flex-1 space-y-2 overflow-auto p-3">
        {loading && <p className="text-sm text-gray-600">Loading messages…</p>}
        {err && <p className="text-sm text-red-600">{err}</p>}
        {!loading && msgs.length === 0 && <p className="text-sm text-gray-600">No messages yet.</p>}

        <ul className="space-y-2">
          {msgs.map((m) => {
            const mine = m.sender_id === me;
            return (
              <li
                key={m.id}
                className={`max-w-[80%] rounded px-3 py-2 text-sm ${mine ? 'ml-auto bg-black text-white' : 'bg-gray-100'}`}
              >
                <div className="text-[11px] opacity-70">{new Date(m.created_at).toLocaleString()}</div>
                <div className="mt-1 whitespace-pre-wrap">{m.text}</div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex gap-2 border-t p-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a message…"
          className="flex-1 rounded border px-3 py-2 text-sm"
        />
        <button
          onClick={send}
          disabled={!draft.trim()}
          className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-60"
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  const sp = useSearchParams();
  const deepThread = sp.get('thread') || undefined;

  const [me, setMe] = useState<string | null>(null);
  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const selected = useMemo(() => threads.find(t => t.request_id === selectedId) || null, [threads, selectedId]);

  // Load user + build thread list
  const load = useCallback(async () => {
    setLoading(true);
    setMsg('');
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id ?? null;
      setMe(uid);
      if (!uid) { setThreads([]); setLoading(false); return; }

      // 1) Pull my message notifications
      const { data: notes, error: nErr } = await supabase
        .from('notifications')
        .select('id, type, data, read_at, created_at')
        .eq('profile_id', uid)
        .or('type.eq.message,type.eq.message_received')
        .order('created_at', { ascending: false })
        .limit(500);
      if (nErr) throw nErr;

      // group by request_id
      const byReq = new Map<string, ThreadItem>();
      const reqIds = new Set<string>();
      for (const n of (notes || []) as any[]) {
        const rid = n?.data?.request_id as string | undefined;
        if (!rid) continue;
        reqIds.add(rid);
        const existing = byReq.get(rid);
        const lastText = (n.data?.text ?? n.data?.message) ?? '';
        const lastAt = n.created_at as string;

        const unreadAdd = n.type === 'message_received' && !n.read_at ? 1 : 0;

        if (!existing) {
          byReq.set(rid, {
            request_id: rid,
            last_at: lastAt,
            last_text: lastText,
            unread: unreadAdd,
            offer_id: (n.data?.offer_id as string) || '',
            offer_title: n.data?.offer_title,
            peer_id: '', // fill later
            peer_name: undefined,
            isOwner: false,
          });
        } else {
          // latest first is from notes order; keep first as latest
          existing.unread += unreadAdd;
        }
      }

      if (reqIds.size === 0) {
        setThreads([]);
        setLoading(false);
        return;
      }

      // 2) Pull related requests (+ offers + requester name)
      const { data: reqRows, error: rErr } = await supabase
        .from('requests')
        .select(`
          id, offer_id, requester_profile_id, status, created_at,
          offers ( id, title, owner_id ),
          requester:profiles ( id, display_name )
        `)
        .in('id', Array.from(reqIds));
      if (rErr) throw rErr;

      // collect peer IDs we might need names for (owner side)
      const needNames = new Set<string>();
      for (const r of (reqRows || []) as any[]) {
        const t = byReq.get(r.id);
        if (!t) continue;
        const isOwner = r.offers?.owner_id === uid;
        const peerId = isOwner ? r.requester_profile_id : r.offers?.owner_id;
        t.isOwner = isOwner;
        t.peer_id = peerId || '';
        t.offer_title = t.offer_title ?? r.offers?.title;
        if (!isOwner) {
          // need owner name, which we don't have yet
          if (peerId) needNames.add(peerId);
        } else {
          // we have requester name from join
          if (!t.peer_name) t.peer_name = r.requester?.display_name ?? undefined;
        }
      }

      // 3) Resolve any missing peer names
      if (needNames.size) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', Array.from(needNames));
        const nameMap = new Map<string, string>();
        for (const p of (profs || []) as any[]) nameMap.set(p.id, p.display_name || 'Someone');
        for (const r of (reqRows || []) as any[]) {
          const t = byReq.get(r.id);
          if (!t || t.peer_name) continue;
          if (!t.isOwner) t.peer_name = nameMap.get(t.peer_id || '') || 'Someone';
        }
      }

      const list = Array.from(byReq.values()).sort((a, b) => (a.last_at < b.last_at ? 1 : -1));
      setThreads(list);

      // Deep link to a particular thread if provided
      if (deepThread && list.some(t => t.request_id === deepThread)) {
        setSelectedId(deepThread);
      } else if (!selectedId && list.length) {
        setSelectedId(list[0].request_id);
      }
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? 'Failed to load your messages.');
      setThreads([]);
    } finally {
      setLoading(false);
    }
  }, [deepThread, selectedId]);

  useEffect(() => {
    load();
  }, [load]);

  // refresh unread/thread list when activity happens within a chat
  const refreshThreads = useCallback(() => {
    load();
  }, [load]);

  return (
    <section className="mx-auto grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-[300px_1fr]">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Messages</h2>
        {msg && <p className="text-sm text-amber-700">{msg}</p>}
        {loading && <p className="text-sm text-gray-600">Loading…</p>}

        <div className="rounded border">
          <ul className="max-h-[70vh] overflow-auto">
            {threads.length === 0 && !loading && (
              <li className="p-3 text-sm text-gray-600">No conversations yet.</li>
            )}
            {threads.map((t) => (
              <li
                key={t.request_id}
                className={`cursor-pointer border-b p-3 text-sm hover:bg-gray-50 ${selectedId === t.request_id ? 'bg-gray-100' : ''}`}
                onClick={() => setSelectedId(t.request_id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{t.peer_name || 'Conversation'}</div>
                    <div className="truncate text-gray-700">{t.offer_title || '—'}</div>
                    <div className="truncate text-xs text-gray-500">{t.last_text || '—'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-gray-500">
                      {new Date(t.last_at).toLocaleString()}
                    </div>
                    {t.unread > 0 && (
                      <div className="mt-1 inline-block min-w-[20px] rounded-full bg-amber-500 px-1 text-center text-[11px] font-bold text-white">
                        {t.unread}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="min-h-[60vh] rounded border">
        {!me && <p className="p-3 text-sm text-gray-600">Please sign in.</p>}
        {me && !selected && <p className="p-3 text-sm text-gray-600">Select a conversation.</p>}
        {me && selected && (
          <ChatWindow
            request={{
              id: selected.request_id,
              offer_id: selected.offer_id,
              requester_profile_id: selected.isOwner ? '' : (me as string), // not used in ChatWindow logic
              status: 'pending',
              created_at: selected.last_at,
              offers: { id: selected.offer_id, title: selected.offer_title || 'Conversation', owner_id: selected.isOwner ? (me as string) : (selected.peer_id || '') },
              requester: undefined,
            }}
            me={me}
            peerName={selected.peer_name}
            onNewActivity={refreshThreads}
          />
        )}
      </div>
    </section>
  );
}
