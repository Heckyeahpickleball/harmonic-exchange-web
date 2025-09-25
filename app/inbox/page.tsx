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
  async function notify(profileId: string, type: 'request_received' | 'request_accepted' | 'request_declined' | 'request_fulfilled' | 'system', data: Record<string, any>) {
    try {
      await supabase.from('notifications').insert({
        profile_id: profileId,
        type,
        data,
      });
    } catch (e) {
      // non-fatal in UI
      console.warn('notify failed', e);
    }
  }

  // --- actions (received) ---
  async function setStatus(req: ReqRow, next: Status) {
    setMsg('');
    // optimistic
    setItems(prev => prev.map(r => (r.id === req.id ? { ...r, status: next, updated_at: new Date().toISOString() } : r)));

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
        if (next === 'accepted') await notify(requesterId, 'request_accepted', { request_id: req.id, offer_id: req.offer_id });
        if (next === 'declined') await notify(requesterId, 'request_declined', { request_id: req.id, offer_id: req.offer_id });
        if (next === 'fulfilled') await notify(requesterId, 'request_fulfilled', { request_id: req.id, offer_id: req.offer_id });
      } else if (tab === 'sent') {
        // if the sender withdraws, ping owner
        const ownerId = req.offers?.owner_id;
        if (next === 'withdrawn' && ownerId) await notify(ownerId, 'system', { kind: 'withdrawn', request_id: req.id, offer_id: req.offer_id });
      }
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? 'Update failed.');
      // revert
      setItems(prev => prev.map(r => (r.id === req.id ? { ...r, status: req.status } : r)));
    }
  }

  return (
    <section className="max-w-4xl">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Inbox</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setTab('received')}
            className={`rounded border px-3 py-1 text-sm ${tab === 'received' ? 'bg-gray-900 text-white' : 'hover:bg-gray-50'}`}
          >
            Received
          </button>
          <button
            onClick={() => setTab('sent')}
            className={`rounded border px-3 py-1 text-sm ${tab === 'sent' ? 'bg-gray-900 text-white' : 'hover:bg-gray-50'}`}
          >
            Sent
          </button>
        </div>
      </div>

      {msg && <p className="text-sm text-amber-700">{msg}</p>}
      {loading && <p className="text-sm text-gray-600">Loading…</p>}

      {/* RECEIVED */}
      {tab === 'received' && (
        <ul className="space-y-3">
          {received.map((r) => (
            <li key={r.id} className="rounded border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-gray-600">{new Date(r.created_at).toLocaleString()}</div>
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
          {!loading && received.length === 0 && <p className="text-sm text-gray-600">No requests yet.</p>}
        </ul>
      )}

      {/* SENT */}
      {tab === 'sent' && (
        <ul className="space-y-3">
          {sent.map((r) => (
            <li key={r.id} className="rounded border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-gray-600">{new Date(r.created_at).toLocaleString()}</div>
                  <div className="mt-1">
                    You requested:{' '}
                    <Link href={`/offers/${r.offer_id}`} className="underline">
                      {r.offers?.title ?? 'this offer'}
                    </Link>
                  </div>
                  <div className="mt-2 whitespace-pre-wrap text-sm">{r.note}</div>
                  <div className="mt-2 text-xs">
                    Status: <span className="font-semibold">{r.status}</span>
                  </div>
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
          {!loading && sent.length === 0 && <p className="text-sm text-gray-600">No sent requests.</p>}
        </ul>
      )}
    </section>
  );
}
