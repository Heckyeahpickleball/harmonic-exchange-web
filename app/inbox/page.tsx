'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
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
  // joined
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

function MessageThread({
  req,
  me,
  tab,
}: {
  req: ReqRow;
  me: string;
  tab: Tab;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const otherId =
    tab === 'received' ? req.requester_profile_id : (req.offers?.owner_id ?? null);

  async function loadThread() {
    if (!open) return;
    setLoading(true);
    setErr(null);
    try {
      // Pull only my copy of the thread (RLS allows only profile_id = me)
      const { data, error } = await supabase
        .from('notifications')
        .select('id, created_at, data')
        .eq('profile_id', me)
        .eq('type', 'message')
        .contains('data', { request_id: req.id })
        .order('created_at', { ascending: true });

      if (error) throw error;

      const mapped: ChatMsg[] = (data || []).map((row: any) => ({
        id: row.id,
        created_at: row.created_at,
        text: row.data?.text ?? '',
        sender_id: row.data?.sender_id ?? '',
      }));
      setMsgs(mapped);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? 'Failed to load messages.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadThread();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, req.id, me]);

  async function send() {
    const text = draft.trim();
    if (!text || !otherId) return;

    setErr(null);
    setDraft('');

    // optimistic append
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
      // Insert a copy for me (so my own message appears), and one for the other party
      const { error } = await supabase.from('notifications').insert([
        { profile_id: me, type: 'message', data: payload },
        { profile_id: otherId, type: 'message', data: payload },
      ]);
      if (error) throw error;
      // reload to replace optimistic with real rows
      await loadThread();
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? 'Failed to send message.');
      // revert optimistic append
      setMsgs((m) => m.filter((x) => x.id !== optimistic.id));
      setDraft(text);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
      >
        {open ? 'Hide messages' : 'Message'}
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

export default function InboxPage() {
  const [tab, setTab] = useState<Tab>('received');
  const [items, setItems] = useState<ReqRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [me, setMe] = useState<string | null>(null);

  // --- helpers ---
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
        // requests where I am the owner of the target offer
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
        // requests I sent
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
      setMsg(e?.message ?? 'Failed to load inbox.');
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

  // --- notification helper (MVP: client inserts) ---
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

  // --- actions (received/sent) ---
  async function setStatus(req: ReqRow, next: Status) {
    setMsg('');
    // optimistic
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

      // notify the other party
      if (tab === 'received') {
        const requesterId = req.requester_profile_id;
        if (next === 'accepted')
          await notify(requesterId, 'request_accepted', { request_id: req.id, offer_id: req.offer_id });
        if (next === 'declined')
          await notify(requesterId, 'request_declined', { request_id: req.id, offer_id: req.offer_id });
        if (next === 'fulfilled')
          await notify(requesterId, 'request_fulfilled', { request_id: req.id, offer_id: req.offer_id });
      } else if (tab === 'sent') {
        // if the sender withdraws, ping owner
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
      // revert
      setItems((prev) => prev.map((r) => (r.id === req.id ? { ...r, status: req.status } : r)));
    }
  }

  return (
    <section className="max-w-4xl">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Inbox</h2>
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

      {/* RECEIVED */}
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
                    <strong>{r.requester?.display_name ?? 'Someone'}</strong> requested:{' '}
                    <Link href={`/offers/${r.offer_id}`} className="underline">
                      {r.offers?.title ?? 'this offer'}
                    </Link>
                  </div>
                  <div className="mt-2 whitespace-pre-wrap text-sm">{r.note}</div>
                  <div className="mt-2 text-xs">
                    Status: <span className="font-semibold">{r.status}</span>
                  </div>
                  <MessageThread req={r} me={me} tab={tab} />
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

      {/* SENT */}
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
                  <MessageThread req={r} me={me} tab={tab} />
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
