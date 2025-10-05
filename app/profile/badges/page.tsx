'use client';

export const dynamic = 'force-dynamic'; // prevent build-time prerender

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type BadgeDef = {
  code: string;
  label: string;
  track: 'give' | 'receive' | 'streak' | 'milestone';
  how: string;
  icon?: string | null;
};

export default function BadgesIndexPage() {
  const [defs, setDefs] = useState<BadgeDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const { data } = await supabase
          .from('badges')
          .select('code,label,track,how:how_to_earn,icon')
          .order('track', { ascending: true })
          .order('tier', { ascending: true });

        if (!alive) return;

        if (data?.length) {
          setDefs(
            data.map((r: any) => ({
              code: r.code,
              label: r.label ?? r.code,
              track: r.track,
              how: r.how ?? '',
              icon: r.icon ?? `/badges/${r.code}.png`,
            }))
          );
        } else {
          // Fallback so the page still renders without DB rows
          setDefs([
            { code: 'give_t1', label: 'Giver • Tier 1', track: 'give', how: 'Complete your first Give.', icon: '/badges/give_t1.png' },
            { code: 'give_t2', label: 'Giver • Tier 2', track: 'give', how: 'Complete 5 Gives.', icon: '/badges/give_t2.png' },
            { code: 'recv_t1', label: 'Receiver • Tier 1', track: 'receive', how: 'Receive your first gift.', icon: '/badges/recv_t1.png' },
            { code: 'streak_7', label: '7-Day Streak', track: 'streak', how: 'Be active 7 days in a row.', icon: '/badges/streak_7.png' },
          ]);
        }
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? 'Failed to load badges.');
        setDefs([]);
      } finally {
        if (alive) setLoading(false);
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

      {loading && <p className="text-sm text-slate-600">Loading…</p>}
      {err && <p className="text-sm text-rose-600">Error: {err}</p>}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 mt-2">
        {defs.map((b) => (
          <div key={b.code} className="flex items-center gap-3 rounded-lg border p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.icon ?? ''} alt={b.label} className="h-10 w-10 rounded-full border" />
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
