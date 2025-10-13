// /components/OfferGratitude.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type Row = {
  id: string;
  message: string;
  created_at: string;
  receiver_profile_id: string;
  offer_title: string | null;
  receiver_name?: string | null;
};

export default function OfferGratitude({ offerId }: { offerId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('public_gratitude_reviews')
          .select('id,message,created_at,receiver_profile_id,offer_title')
          .eq('offer_id', offerId)
          .order('created_at', { ascending: false })
          .limit(3);

        if (error) throw error;
        if (!cancel) setRows((data as any) ?? []);
      } catch (e: any) {
        if (!cancel) setErr(e?.message ?? 'Could not load gratitude.');
      }
    })();
    return () => { cancel = true; };
  }, [offerId]);

  if (err) return null;
  if (!rows.length) return null;

  return (
    <div className="rounded border p-3 bg-white">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Gratitude from receivers</h3>
        <Link href="/reviews" className="text-sm underline">See all</Link>
      </div>

      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="rounded border p-2">
            <div className="text-[11px] text-gray-500">{new Date(r.created_at).toLocaleDateString()}</div>
            <p className="mt-1 text-sm whitespace-pre-wrap">{r.message}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
