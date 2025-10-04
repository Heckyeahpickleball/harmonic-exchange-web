// File: app/inbox/[id]/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type RequestRow = {
  id: string;
  offer_id: string;
  requester_profile_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'withdrawn' | 'fulfilled';
  note: string;
  created_at: string;
  offer: { id: string; title: string; owner_id: string } | null;
};

type Msg = {
  id: string;
  author_profile_id: string;
  body: string;
  created_at: string;
};

export default function RequestThreadPage() {
  const { id } = useParams<{ id: string }>();
  const [uid, setUid] = useState<string | null>(null);
  const [row, setRow] = useState<RequestRow | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!cancelled) setUid(data.user?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const scrollToBottomSoon = () => {
    // Give DOM a tick to paint before scrolling
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const loadAll = async () => {
    const { data: r, error: reqErr } = await supabase
      .from('requests')
      .select('id,offer_id,requester_profile_id,status,note,created_at, offer:offers(id,title,owner_id)')
      .eq('id', id)
      .single();

    if (reqErr) {
      console.error(reqErr);
      setRow(null);
    } else {
      setRow(r as unknown as RequestRow);
    }

    const { data: m, error: msgErr } = await supabase
      .from('request_messages')
      .select('id,author_profile_id,body,created_at')
      .eq('request_id', id)
      .order('created_at', { ascending: true });

    if (msgErr) {
      console.error(msgErr);
      setMsgs([]);
    } else {
      setMsgs((m || []) as Msg[]);
    }

    scrollToBottomSoon();
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await loadAll();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Realtime new messages
  useEffect(() => {
    const ch = supabase
      .channel(`req-${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'request_messages', filter: `request_id=eq.${id}` },
        (payload) => {
          setMsgs((prev) => [...prev, payload.new as unknown as Msg]);
          scrollToBottomSoon();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id]);

  const isOwner = !!(uid && row?.offer?.owner_id === uid);
  const otherId =
    uid && row ? (isOwner ? row.requester_profile_id : row.offer?.owner_id || null) : null;

  async function sendMessage() {
    const body = text.trim();
    if (!body || !uid) return;
    setSending(true);
    try {
      const { error } = await supabase.from('request_messages').insert({
        request_id: id,
        author_profile_id: uid,
        body,
      });
      if (error) throw error;

      // best-effort notify the other party
      if (otherId) {
        await supabase.from('notifications').insert({
          profile_id: otherId,
          type: 'message',
          data: { request_id: id },
        });
      }

      setText('');
      // realtime will append the message; as fallback we could push optimistically.
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
      scrollToBottomSoon();
    }
  }

  async function setStatus(next: RequestRow['status']) {
    if (!row) return;
    const { error } = await supabase.from('requests').update({ status: next }).eq('id', row.id);
    if (error) {
      console.error(error);
      return;
    }
    if (otherId) {
      await supabase.from('notifications').insert({
        profile_id: otherId,
        type: `request_${next}`,
        data: { request_id: row.id, offer_id: row.offer_id },
      });
    }
    await loadAll();
  }

  return (
    <section className="max-w-3xl">
      <Link href="/inbox" className="text-sm underline">
        &larr; Back to Inbox
      </Link>

      <h2 className="mt-2 text-2xl font-bold">Request</h2>

      {row ? (
        <>
          <div className="mt-1 text-sm text-gray-600">
            {row.offer?.title ?? '—'} • {row.status}
          </div>

          {/* Actions */}
          <div className="mt-3 flex flex-wrap gap-2">
            {row.status === 'pending' && isOwner && (
              <>
                <button
                  onClick={() => setStatus('accepted')}
                  className="rounded border px-2 py-1 text-sm hover:bg-gray-50"
                >
                  Accept
                </button>
                <button
                  onClick={() => setStatus('declined')}
                  className="rounded border px-2 py-1 text-sm hover:bg-gray-50"
                >
                  Decline
                </button>
              </>
            )}
            {row.status === 'accepted' && (
              <button
                onClick={() => setStatus('fulfilled')}
                className="rounded border px-2 py-1 text-sm hover:bg-gray-50"
              >
                Mark fulfilled
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="mt-4 rounded border p-3">
            <div className="max-h-[50vh] space-y-2 overflow-auto">
              <div className="rounded bg-gray-50 p-2 text-sm">
                <div className="text-xs text-gray-500">
                  {new Date(row.created_at).toLocaleString()}
                </div>
                <div>
                  <span className="font-medium">{row.requester_profile_id}</span>: {row.note}
                </div>
              </div>
              {msgs.map((m) => (
                <div
                  key={m.id}
                  className={`rounded p-2 text-sm ${
                    m.author_profile_id === uid ? 'bg-blue-50' : 'bg-gray-50'
                  }`}
                >
                  <div className="text-xs text-gray-500">
                    {new Date(m.created_at).toLocaleString()}
                  </div>
                  <div>
                    <span className="font-medium">{m.author_profile_id}</span>: {m.body}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="mt-3 flex gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Write a message… (Enter to send)"
                className="w-full rounded border px-3 py-2"
              />
              <button
                onClick={sendMessage}
                disabled={sending || !text.trim()}
                className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </>
      ) : (
        <p className="mt-3">Loading…</p>
      )}
    </section>
  );
}
