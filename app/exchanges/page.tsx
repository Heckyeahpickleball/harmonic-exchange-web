'use client';

import { Suspense, useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Status = 'pending' | 'accepted' | 'declined' | 'withdrawn' | 'fulfilled';

type ReqRow = {
  id: string;
  offer_id: string;
  requester_profile_id: string;
  note: string;
  status: Status;
  created_at: string;
  updated_at: string | null;
  offers?: { id: string; title: string; owner_id: string };
  requester?: { id: string; display_name: string | null };
};

type Tab = 'received' | 'sent';

type ChatMsg = {
  id: string;
  created_at: string;
  text: string;
  sender_id: string;
};

function useSafeThreadParam() {
  const searchParams = useSearchParams();
  const [thread, setThread] = useState<string | undefined>(undefined);
  useEffect(() => {
    setThread(searchParams.get('thread') || undefined);
  }, [searchParams]);
  return thread;
}

function MessageThread({
  req,
  me,
  tab,
  autoOpen,
}: {
  req: ReqRow;
  me: string;
  tab: Tab;
  autoOpen?: boolean;
}) {
  // ... (leave your MessageThread code here unchanged)
  const [open, setOpen] = useState<boolean>(!!autoOpen);
  const [loading, setLoading] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [unread, setUnread] = useState<number>(0);

  const otherId =
    tab === 'received' ? req.requester_profile_id : (req.offers?.owner_id ?? null);

  async function countUnreadForThread() {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', me)
      .eq('type', 'message_received')
      .is('read_at', null)
      .contains('data', { request_id: req.id });

    if (!error) setUnread(count ?? 0);
  }

  async function markThreadRead() {
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('profile_id', me)
      .eq('type', 'message_received')
      .is('read_at', null)
      .contains('data', { request_id: req.id });

    setUnread(0);
  }

  async function loadThread() {
    if (!open) return;
    setLoading(true);
    setErr(null);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, created_at, type, data')
        .eq('profile_id', me)
        .or('type.eq.message,type.eq.message_received')
        .contains('data', { request_id: req.id })
        .order('created_at', { ascending: true });

      if (error) throw error;

      const mapped: ChatMsg[] = (data || []).map((row: any) => ({
        id: row.id,
        created_at: row.created_at,
        text: (row.data?.text ?? row.data?.message) ?? '',
        sender_id: row.data?.sender_id ?? '',
      }));
      setMsgs(mapped);

      await markThreadRead();
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? 'Failed to load messages.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    countUnreadForThread().catch(() => {});
  }, [req.id, me]);

  useEffect(() => {
    if (unread > 0) setOpen(true);
  }, [unread]);

  useEffect(() => {
    loadThread();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, req.id, me]);

  useEffect(() => {
    if (!me) return;

    const channel = supabase
      .channel(`realtime:thread:${req.id}:${me}`)
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
            n?.data?.request_id === req.id
          ) {
            const msg: ChatMsg = {
              id: n.id,
              created_at: n.created_at,
              text: (n.data?.text ?? n.data?.message) ?? '',
              sender_id: n.data?.sender_id ?? '',
            };
            if (open) {
              setMsgs((m) => [...m, msg]);
              if (n.type === 'message_received') {
                supabase
                  .from('notifications')
                  .update({ read_at: new Date().toISOString() })
                  .eq('id', n.id)
                  .then(() => {});
              }
            } else {
              if (n.type === 'message_received') setUnread((u) => u + 1);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [me, req.id, open]);

  async function send() {
    const text = draft.trim();
    if (!text || !otherId) return;

    setErr(null);
    setDraft('');

    const optimistic: ChatMsg = {
      id: `tmp-${Math.random().toString(36).slice(2)}`,
      created_at: new Date().toISOString(),
      text,
      sender_id: me,
    };
    setMsgs((m) => [...m, optimistic]);

    try {
      const payload = {
        request_id: req.id,
        offer_id: req.offer_id,
        sender_id: me,
        text,
      };

      const now = new Date().toISOString();

      const { error } = await supabase.from('notifications').insert([
        { profile_id: me, type: 'message', data: payload, read_at: now },
        { profile_id: otherId, type: 'message_received', data: payload },
      ]);
      if (error) throw error;

      await loadThread();
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? 'Failed to send message.');
      setMsgs((m) => m.filter((x) => x.id !== optimistic.id));
      setDraft(text);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded border px-3 py-1 text-sm hover:bg-gray-50 relative"
      >
        {open ? 'Hide messages' : 'Message'}
        {unread > 0 && !open && (
          <span className="absolute -right-2 -top-2 rounded-full bg-amber-500 px-1 text-[11px] font-bold text-white min-w-[18px] text-center">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="mt-2 rounded border p-3">
          {loading && <p className="text-sm text-gray-600">Loading messages…</p>}
          {err && <p className="text-sm text-red-600">{err}</p>}
          {msgs.length === 0 && !loading && (
            <p className="text-sm text-gray-600">No messages yet.</p>
          )}

          <ul className="space-y-2">
            {msgs.map((m) => {
              const mine = m.sender_id === me;
              return (
                <li
                  key={m.id}
                  className={`max-w-[85%] rounded px-3 py-2 text-sm ${
                    mine ? 'ml-auto bg-black text-white' : 'bg-gray-100'
                  }`}
                >
                  <div className="opacity-70 text-[11px]">
                    {new Date(m.created_at).toLocaleString()}
                  </div>
                  <div className="mt-1 whitespace-pre-wrap">{m.text}</div>
                </li>
              );
            })}
          </ul>

          <div className="mt-3 flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write a message…"
              className="flex-1 rounded border px-3 py-2 text-sm"
            />
            <button
              onClick={send}
              disabled={!draft.trim() || !otherId}
              className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-60"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ExchangesContent() {
  const thread = useSafeThreadParam();

  const [tab, setTab] = useState<Tab>('received');
  const [items, setItems] = useState<ReqRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [me, setMe] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMsg('');

    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id ?? null;
    setMe(uid);

    if (!uid) {
      setItems([]);
      setLoading(false);
      return;
    }

    try {
      if (tab === 'received') {
        const { data, error } = await supabase
          .from('requests')
          .select(`
            id, offer_id, requester_profile_id, note, status, created_at, updated_at,
            offers!inner ( id, title, owner_id ),
            requester:profiles ( id, display_name )
          `)
          .eq('offers.owner_id', uid)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setItems((data || []) as unknown as ReqRow[]);
      } else {
        const { data, error } = await supabase
          .from('requests')
          .select(`
            id, offer_id, requester_profile_id, note, status, created_at, updated_at,
            offers ( id, title, owner_id ),
            requester:profiles ( id, display_name )
          `)
          .eq('requester_profile_id', uid)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setItems((data || []) as unknown as ReqRow[]);
      }
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? 'Failed to load exchanges.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const received = useMemo(() => (tab === 'received' ? items : []), [tab, items]);
  const sent = useMemo(() => (tab === 'sent' ? items : []), [tab, items]);

  async function notify(
    profileId: string,
    type: 'request_received' | 'request_accepted' | 'request_declined' | 'request_fulfilled' | 'system',
    data: Record<string, any>
  ) {
    try {
      await supabase.from('notifications').insert({
        profile_id: profileId,
        type,
        data,
      });
    } catch (e) {
      console.warn('notify failed', e);
    }
  }

  async function setStatus(req: ReqRow, next: Status) {
    setMsg('');
    setItems((prev) =>
      prev.map((r) =>
        r.id === req.id ? { ...r, status: next, updated_at: new Date().toISOString() } : r
      )
    );

    try {
      const { error } = await supabase
        .from('requests')
        .update({ status: next })
        .eq('id', req.id)
        .select('id')
        .single();
      if (error) throw error;

      if (tab === 'received') {
        const requesterId = req.requester_profile_id;
        if (next === 'accepted')
          await notify(requesterId, 'request_accepted', { request_id: req.id, offer_id: req.offer_id });
        if (next === 'declined')
          await notify(requesterId, 'request_declined', { request_id: req.id, offer_id: req.offer_id });
        if (next === 'fulfilled')
          await notify(requesterId, 'request_fulfilled', { request_id: req.id, offer_id: req.offer_id });
      } else if (tab === 'sent') {
        const ownerId = req.offers?.owner_id;
        if (next === 'withdrawn' && ownerId)
          await notify(ownerId, 'system', {
            kind: 'withdrawn',
            request_id: req.id,
            offer_id: req.offer_id,
          });
      }
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? 'Update failed.');
      setItems((prev) => prev.map((r) => (r.id === req.id ? { ...r, status: req.status } : r)));
    }
  }

  return (
    <section className="max-w-4xl">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Exchanges</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setTab('received')}
            className={`rounded border px-3 py-1 text-sm ${
              tab === 'received' ? 'bg-gray-900 text-white' : 'hover:bg-gray-50'
            }`}
          >
            Received
          </button>
          <button
            onClick={() => setTab('sent')}
            className={`rounded border px-3 py-1 text-sm ${
              tab === 'sent' ? 'bg-gray-900 text-white' : 'hover:bg-gray-50'
            }`}
          >
            Sent
          </button>
        </div>
      </div>

      {msg && <p className="text-sm text-amber-700">{msg}</p>}
      {loading && <p className="text-sm text-gray-600">Loading…</p>}

      {tab === 'received' && me && (
        <ul className="space-y-3">
          {received.map((r) => (
            <li key={r.id} className="rounded border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-gray-600">
                    {new Date(r.created_at).toLocaleString()}
                  </div>
                  <div className="mt-1">
                    <strong>{r.requester?.display_name ?? 'Someone'}</strong> requested{' '}
                    <Link href={`/offers/${r.offer_id}`} className="underline">
                      {r.offers?.title ?? 'this offer'}
                    </Link>
                  </div>
                  <div className="mt-2 whitespace-pre-wrap text-sm">{r.note}</div>
                  <div className="mt-2 text-xs">
                    Status: <span className="font-semibold">{r.status}</span>
                  </div>

                  <MessageThread
                    req={r}
                    me={me}
                    tab={tab}
                    autoOpen={thread === r.id}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  {r.status === 'pending' && (
                    <>
                      <button
                        onClick={() => setStatus(r, 'accepted')}
                        className="rounded bg-black px-3 py-1 text-sm text-white"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => setStatus(r, 'declined')}
                        className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
                      >
                        Decline
                      </button>
                    </>
                  )}
                  {r.status === 'accepted' && (
                    <button
                      onClick={() => setStatus(r, 'fulfilled')}
                      className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
                    >
                      Mark Fulfilled
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
          {!loading && received.length === 0 && (
            <p className="text-sm text-gray-600">No requests yet.</p>
          )}
        </ul>
      )}

      {tab === 'sent' && me && (
        <ul className="space-y-3">
          {sent.map((r) => (
            <li key={r.id} className="rounded border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-gray-600">
                    {new Date(r.created_at).toLocaleString()}
                  </div>
                  <div className="mt-1">
                    You requested{' '}
                    <Link href={`/offers/${r.offer_id}`} className="underline">
                      {r.offers?.title ?? 'this offer'}
                    </Link>
                  </div>
                  <div className="mt-2 whitespace-pre-wrap text-sm">{r.note}</div>
                  <div className="mt-2 text-xs">
                    Status: <span className="font-semibold">{r.status}</span>
                  </div>

                  <MessageThread
                    req={r}
                    me={me}
                    tab={tab}
                    autoOpen={thread === r.id}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  {r.status === 'pending' && (
                    <button
                      onClick={() => setStatus(r, 'withdrawn')}
                      className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
                    >
                      Withdraw
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
          {!loading && sent.length === 0 && (
            <p className="text-sm text-gray-600">No sent requests.</p>
          )}
        </ul>
      )}
    </section>
  );
}

// Suspense wrapper is required for Next 15+ if you use useSearchParams in the page tree.
export default function ExchangesPage() {
  return (
    <Suspense fallback={<div className="text-sm text-gray-600">Loading…</div>}>
      <ExchangesContent />
    </Suspense>
  );
}