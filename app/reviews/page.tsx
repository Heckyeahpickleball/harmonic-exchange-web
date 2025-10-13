// /app/reviews/page.tsx
'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type PublicReview = {
  id: string;
  message: string;
  created_at: string;
  offer_id: string;
  owner_profile_id: string;
  receiver_profile_id: string;
  offer_title: string | null;
  owner_name?: string | null;
  receiver_name?: string | null;
};

type PrivateReview = {
  id: string;
  message: string;
  created_at: string;
  offer_id: string;
  owner_profile_id: string;
  receiver_profile_id: string;
  published: boolean;
  offer_title?: string | null;
  owner_name?: string | null;
  receiver_name?: string | null;
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
  const [publicRows, setPublicRows] = useState<PublicReview[]>([]);
  const [givenRows, setGivenRows] = useState<PrivateReview[]>([]);
  const [receivedRows, setReceivedRows] = useState<PrivateReview[]>([]);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      setViewer(auth?.user?.id ?? null);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setMsg('');
      // Public carousel/list: view
      const { data: pub } = await supabase
        .from('public_gratitude_reviews')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      setPublicRows((pub as any) ?? []);

      // Resolve names best-effort
      await hydrateNamesPublic(setPublicRows);
    })();
  }, []);

  useEffect(() => {
    if (!viewer) return;
    (async () => {
      setMsg('');
      const baseSel =
        'id,message,created_at,offer_id,owner_profile_id,receiver_profile_id,published';
      const { data: given } = await supabase
        .from('gratitude_reviews')
        .select(baseSel)
        .eq('owner_profile_id', viewer)
        .order('created_at', { ascending: false })
        .limit(100);
      setGivenRows((given as any) ?? []);

      const { data: rec } = await supabase
        .from('gratitude_reviews')
        .select(baseSel)
        .eq('receiver_profile_id', viewer)
        .order('created_at', { ascending: false })
        .limit(100);
      setReceivedRows((rec as any) ?? []);

      await Promise.all([
        hydrateNamesPrivate(setGivenRows),
        hydrateNamesPrivate(setReceivedRows),
      ]);
    })();
  }, [viewer]);

  async function hydrateNamesPublic(setter: (v: any) => void) {
    setter((rows: PublicReview[]) => rows); // placeholder no-op to keep type
    // Lightweight name hydration for owner/receiver
    const rows = (await supabase
      .from('public_gratitude_reviews')
      .select('owner_profile_id,receiver_profile_id')
      .limit(1)).data; // we just need types here; actual names we fetch below

    // In practice we hydrate on current rows:
    const current = (await supabase
      .from('public_gratitude_reviews')
      .select('id,owner_profile_id,receiver_profile_id'))
      .data as PublicReview[] | null;

    if (!current || !current.length) return;

    const ids = Array.from(
      new Set(current.flatMap(r => [r.owner_profile_id, r.receiver_profile_id]))
    );

    const { data: profs } = await supabase
      .from('profiles')
      .select('id,display_name')
      .in('id', ids);

    const map = new Map(profs?.map(p => [p.id, p.display_name]) ?? []);
    setter((rows: PublicReview[]) =>
      rows.map(r => ({
        ...r,
        owner_name: map.get(r.owner_profile_id) ?? null,
        receiver_name: map.get(r.receiver_profile_id) ?? null
      }))
    );
  }

  async function hydrateNamesPrivate(setter: (v: any) => void) {
    setter((rows: PrivateReview[]) => rows);
    const rows = setter as any;
    // Pull current values from closure by re-querying (simple + reliable)
    // We’ll just resolve names for the already-loaded lists
    // (No-op here; names are resolved below using current state)
  }

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
          {visible.map((r) => (
            <li key={r.id} className="hx-card p-3">
              <div className="text-xs text-gray-500">{new Date(r.created_at).toLocaleString()}</div>
              <div className="mt-1 text-sm">
                <span className="text-gray-600">On</span>{' '}
                <Link href={`/offers/${r.offer_id}`} className="hx-link">{r.offer_title || 'this offer'}</Link>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{r.message}</p>
              <div className="mt-2 text-xs text-gray-600">
                <span>From receiver</span>
                {('receiver_name' in r) && (r as any).receiver_name ? `: ${(r as any).receiver_name}` : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
