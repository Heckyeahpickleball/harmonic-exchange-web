// /app/reviews/page.tsx
'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type PublicRow = {
  id: string;
  created_at: string;
  message: string | null;
  offer_id: string;
  offer_title: string | null;
  owner_id: string | null;
  owner_name: string | null;
  receiver_id: string | null;
  receiver_name: string | null;
};

type PrivateRow = {
  id: string;
  message: string;
  created_at: string;
  offer_id: string;
  owner_profile_id: string;
  receiver_profile_id: string;
  published?: boolean;
};

export default function Page() {
  return (
    <Suspense fallback={<section className="max-w-5xl p-4 text-sm text-gray-600">Loading…</section>}>
      <ReviewsIndex />
    </Suspense>
  );
}

type Tab = 'public' | 'given' | 'received';

function ReviewsIndex() {
  const [tab, setTab] = useState<Tab>('public');
  const [viewer, setViewer] = useState<string | null>(null);
  const [publicRows, setPublicRows] = useState<PublicRow[]>([]);
  const [givenRows, setGivenRows] = useState<PrivateRow[]>([]);
  const [receivedRows, setReceivedRows] = useState<PrivateRow[]>([]);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      setViewer(auth?.user?.id ?? null);
    })();
  }, []);

  // Public tab – RLS-safe
  useEffect(() => {
    (async () => {
      setMsg('');
      const { data, error } = await supabase.rpc('public_reviews_feed', { limit_n: 100 });
      if (error) {
        console.error('public reviews error:', error);
        setPublicRows([]);
        setMsg('Couldn’t load public reviews.');
        return;
      }
      setPublicRows((data ?? []) as PublicRow[]);
    })();
  }, []);

  // Given/Received (viewer-only, uses your view)
  useEffect(() => {
    if (!viewer) return;
    (async () => {
      setMsg('');
      const baseSel = 'id,message,created_at,offer_id,owner_profile_id,receiver_profile_id';
      const { data: given, error: gErr } = await supabase
        .from('gratitude_reviews')
        .select(baseSel)
        .eq('owner_profile_id', viewer)
        .order('created_at', { ascending: false })
        .limit(100);
      if (!gErr) setGivenRows((given as any) ?? []);

      const { data: rec, error: rErr } = await supabase
        .from('gratitude_reviews')
        .select(baseSel)
        .eq('receiver_profile_id', viewer)
        .order('created_at', { ascending: false })
        .limit(100);
      if (!rErr) setReceivedRows((rec as any) ?? []);
    })();
  }, [viewer]);

  const visible =
    tab === 'public' ? publicRows : tab === 'given' ? givenRows : receivedRows;

  const TAB_BTN = (active: boolean) =>
    `rounded border px-3 py-1 text-sm ${active ? 'bg-gray-900 text-white' : 'hover:bg-gray-50'}`;

  return (
    <section className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Past Exchanges</h1>
        <Link href="/" className="text-sm underline">← Home</Link>
      </div>

      <div className="flex gap-2">
        <button className={TAB_BTN(tab === 'public')} onClick={() => setTab('public')}>Public</button>
        <button className={TAB_BTN(tab === 'given')} onClick={() => setTab('given')} disabled={!viewer}>Given</button>
        <button className={TAB_BTN(tab === 'received')} onClick={() => setTab('received')} disabled={!viewer}>Received</button>
      </div>

      {msg && <p className="text-sm text-amber-700">{msg}</p>}

      {visible.length === 0 ? (
        <p className="text-sm text-gray-600">No gratitude to show yet.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3">
          {visible.map((r: any) => (
            <li key={r.id} className="hx-card p-3">
              <div className="text-xs text-gray-500">{new Date(r.created_at).toLocaleString()}</div>

              {tab === 'public' ? (
                <div className="mt-1 text-sm">
                  <span className="text-gray-600">On</span>{' '}
                  <Link href={`/offers/${r.offer_id}`} className="hx-link">
                    {r.offer_title || 'this offer'}
                  </Link>{' '}
                  from <span className="font-medium">{r.owner_name || 'Provider'}</span>
                </div>
              ) : (
                <div className="mt-1 text-sm">
                  <span className="text-gray-600">On</span>{' '}
                  <Link href={`/offers/${r.offer_id}`} className="hx-link">this offer</Link>
                </div>
              )}

              <p className="mt-2 whitespace-pre-wrap text-sm">{r.message}</p>

              {tab === 'public' && r.receiver_name ? (
                <div className="mt-2 text-xs text-gray-600">From {r.receiver_name}</div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
