// /app/badges/page.tsx
'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type Row = {
  code: string;
  label: string | null;
  track: 'give' | 'receive' | 'streak' | 'milestone' | null;
  how: string | null;
  icon: string | null;
};

export default function AllBadgesPage() {
  const [defs, setDefs] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('badges')
          .select('code,label,track,how:how_to_earn,icon')
          .order('track', { ascending: true })
          .order('tier', { ascending: true });

        if (!alive) return;
        if (error) throw error;

        if (data?.length) {
          setDefs(
            data.map((r: any) => ({
              code: r.code,
              label: r.label ?? r.code,
              track: r.track ?? null,
              how: r.how ?? '',
              icon: r.icon ?? `/badges/${r.code}.png`,
            }))
          );
        } else {
          // small fallback
          setDefs([
            { code: 'give_t1', label: 'Giver • Tier 1', track: 'give', how: 'Complete your first Give.', icon: '/badges/give_t1.png' },
            { code: 'recv_t1', label: 'Receiver • Tier 1', track: 'receive', how: 'Receive your first gift.', icon: '/badges/recv_t1.png' },
            { code: 'streak_7', label: '7-Day Streak', track: 'streak', how: 'Be active 7 days in a row.', icon: '/badges/streak_7.png' },
          ]);
        }
      } catch (e: any) {
        setErr(e?.message ?? 'Failed to load badges.');
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <section className="mx-auto max-w-3xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold">All Badges & How to Earn Them</h1>
        <Link href="/profile" className="text-sm underline">Back to Profile</Link>
      </div>

      {err && <p className="mb-3 text-sm text-rose-600">{err}</p>}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {defs.map((b) => (
          <div key={b.code} className="flex items-center gap-3 rounded-lg border p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.icon ?? ''} alt={b.label ?? b.code} className="h-10 w-10 rounded-full border" />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{b.label}</div>
              <div className="text-xs text-slate-600">{b.how}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
