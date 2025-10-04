'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient'; // ✅ use alias, not ../../lib/...

type Row = Record<string, any>;

export default function GamificationDebug() {
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [given, setGiven] = useState<number>(0);
  const [received, setReceived] = useState<number>(0);
  const [streakDays, setStreakDays] = useState<number>(0);

  const [badges, setBadges] = useState<Row[] | null>(null);
  const [awards, setAwards] = useState<Row[] | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const u = auth?.user?.id ?? null;
        setUid(u);
        if (!u) { setLoading(false); return; }

        // GIVEN: my offer was fulfilled
        {
          const { data } = await supabase
            .from('requests')
            .select('id, offers!inner(owner_id)')
            .eq('status', 'fulfilled')
            .eq('offers.owner_id', u);
          setGiven((data || []).length);
        }

        // RECEIVED: I requested and it was fulfilled
        {
          const { data } = await supabase
            .from('requests')
            .select('id')
            .eq('status', 'fulfilled')
            .eq('requester_profile_id', u);
          setReceived((data || []).length);
        }

        // Very simple streak: consecutive days with a fulfilled request I participated in
        {
          const { data } = await supabase
            .from('requests')
            .select('id, created_at, requester_profile_id, offers!inner(owner_id)')
            .eq('status', 'fulfilled')
            .or(`requester_profile_id.eq.${u},offers.owner_id.eq.${u}`)
            .order('created_at', { ascending: false })
            .limit(500);

          const days = new Set<string>();
          for (const r of (data || []) as any[]) {
            const d = new Date(r.created_at);
            const iso = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
              .toISOString().slice(0,10);
            days.add(iso);
          }
          let streak = 0;
          const today = new Date();
          for (let i = 0; i < 60; i++) {
            const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
            d.setUTCDate(d.getUTCDate() - i);
            const iso = d.toISOString().slice(0,10);
            if (days.has(iso)) streak++; else break;
          }
          setStreakDays(streak);
        }

        // Optional tables if they exist
        try {
          const { data } = await supabase.from('badges').select('*').order('id', { ascending: true });
          if (data) setBadges(data as Row[]);
        } catch {}

        // Try a few common award table names
        for (const t of ['badge_awards','profile_badges','user_badges']) {
          try {
            const { data } = await supabase
              .from(t)
              .select('*')
              .eq('profile_id', u)
              .order('created_at', { ascending: false })
              .limit(100);
            if (data) { setAwards(data as Row[]); break; }
          } catch {}
        }

      } catch (e: any) {
        console.error(e);
        setErr(e?.message ?? 'Failed to load gamification status.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const tableFound = useMemo(() => ({
    badges: Array.isArray(badges),
    awards: Array.isArray(awards),
  }), [badges, awards]);

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Gamification Debug</h1>
      {!uid && <p className="text-sm text-gray-600">Sign in to test.</p>}
      {err && <p className="text-sm text-red-600">{err}</p>}
      {loading && <p className="text-sm text-gray-600">Loading…</p>}

      {uid && !loading && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="hx-card p-4">
              <div className="text-sm text-gray-600">Given (fulfilled)</div>
              <div className="text-2xl font-bold">{given}</div>
            </div>
            <div className="hx-card p-4">
              <div className="text-sm text-gray-600">Received (fulfilled)</div>
              <div className="text-2xl font-bold">{received}</div>
            </div>
            <div className="hx-card p-4">
              <div className="text-sm text-gray-600">Streak (days)</div>
              <div className="text-2xl font-bold">{streakDays}</div>
            </div>
          </div>

          <div className="hx-card p-4 space-y-3">
            <h2 className="text-lg font-semibold">Badge data</h2>

            {!tableFound.badges && !tableFound.awards && (
              <p className="text-sm text-gray-600">
                No <code>badges</code> or award table found yet — badges may be stored elsewhere (e.g. on the profile).
              </p>
            )}

            {tableFound.badges && (
              <div>
                <div className="text-sm font-medium mb-1">badges</div>
                <pre className="text-xs overflow-auto bg-gray-50 p-2 rounded">{JSON.stringify(badges, null, 2)}</pre>
              </div>
            )}

            {tableFound.awards && (
              <div>
                <div className="text-sm font-medium mb-1">awards (for you)</div>
                <pre className="text-xs overflow-auto bg-gray-50 p-2 rounded">{JSON.stringify(awards, null, 2)}</pre>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
