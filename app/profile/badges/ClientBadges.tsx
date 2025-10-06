'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type ExpandedBadge = {
  badge_code: string | null;
  track: 'give' | 'receive' | 'streak' | 'milestone' | null;
  tier: number | null;
  label: string | null;
  icon: string | null;
  earned_at: string | null;
};

type CatalogItem = {
  badge_code: string;
  track: 'give' | 'receive' | 'streak';
  tier: number;
  title: string;
  defaultIcon: string;
  howTo: string;
};

// canonical thresholds per tier
const TIER_COUNTS = [1, 5, 10, 20, 40, 100];

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}

function howToFor(track: 'give' | 'receive' | 'streak', tier: number): string {
  if (track === 'streak') return 'Participate 7 days in a row';
  const count = TIER_COUNTS[(tier - 1) as 0 | 1 | 2 | 3 | 4 | 5] ?? tier;
  const action = track === 'give' ? 'Give' : 'Receive';
  const noun =
    track === 'give' ? plural(count, 'gift', 'gifts') : plural(count, 'receiving', 'receivings');
  if (tier === 1) return track === 'give' ? 'Give your first gift' : 'Receive your first gift';
  return `${action} ${count} ${noun}`;
}

const CATALOG: CatalogItem[] = [
  ...Array.from({ length: 6 }, (_, i) => {
    const t = i + 1;
    return {
      badge_code: `give_t${t}`,
      track: 'give' as const,
      tier: t,
      title: t === 1 ? 'First Gift' : `Give • Tier ${t}`,
      defaultIcon: `/badges/give_rays_t${t}.png`,
      howTo: howToFor('give', t),
    };
  }),
  ...Array.from({ length: 6 }, (_, i) => {
    const t = i + 1;
    return {
      badge_code: `recv_t${t}`,
      track: 'receive' as const,
      tier: t,
      title: t === 1 ? 'First Receiving' : `Receive • Tier ${t}`,
      defaultIcon: `/badges/receive_bowl_t${t}.png`,
      howTo: howToFor('receive', t),
    };
  }),
  {
    badge_code: 'streak_7',
    track: 'streak',
    tier: 1,
    title: '7-day Flow Streak',
    defaultIcon: '/badges/streak_wave.png',
    howTo: howToFor('streak', 1),
  },
];

function iconFor(row: ExpandedBadge): string {
  if (row?.icon && row.icon.startsWith('/badges/')) return row.icon;
  const track = (row.track ?? '').toLowerCase();
  const tier = row.tier ?? 1;
  if (track === 'give') return `/badges/give_rays_t${tier}.png`;
  if (track === 'receive') return `/badges/receive_bowl_t${tier}.png`;
  if (track === 'streak') return `/badges/streak_wave.png`;
  const code = (row.badge_code ?? '').toLowerCase();
  if (code.startsWith('give_')) return `/badges/give_rays_t${tier}.png`;
  if (code.startsWith('recv') || code.startsWith('receive')) return `/badges/receive_bowl_t${tier}.png`;
  if (code.startsWith('streak')) return `/badges/streak_wave.png`;
  return '/badges/give_rays_t1.png';
}

export default function ClientBadges() {
  const search = useSearchParams();
  const requestedId = search.get('id') || null;

  const [viewerId, setViewerId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [rows, setRows] = useState<ExpandedBadge[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const me = auth?.user?.id ?? null;
      setViewerId(me);
      setTargetId(requestedId || me || null);
    })();
  }, [requestedId]);

  useEffect(() => {
    if (!targetId) {
      setRows([]);
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      setMsg('');
      try {
        const { data, error } = await supabase
          .from('profile_badges_expanded')
          .select('badge_code,track,tier,label,icon,earned_at')
          .eq('profile_id', targetId);
        if (error) throw error;
        setRows((data as ExpandedBadge[]) || []);
      } catch (e: any) {
        console.error(e);
        setMsg(e?.message ?? 'Failed to load badges.');
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [targetId]);

  const earnedByTrackTier = useMemo(() => {
    const m = new Map<string, ExpandedBadge>();
    (rows || []).forEach((r) => {
      const key = `${(r.track ?? '').toLowerCase()}::${r.tier ?? 0}`;
      m.set(key, r);
    });
    return m;
  }, [rows]);

  const earnedByCode = useMemo(() => {
    const m = new Map<string, ExpandedBadge>();
    (rows || []).forEach((r) => {
      if (r.badge_code) m.set(r.badge_code.toLowerCase(), r);
    });
    return m;
  }, [rows]);

  function findEarned(c: CatalogItem): ExpandedBadge | null {
    const byCode = earnedByCode.get(c.badge_code.toLowerCase());
    if (byCode) return byCode;
    const byTT = earnedByTrackTier.get(`${c.track}::${c.tier}`);
    return byTT ?? null;
  }

  const viewingSelf = targetId && viewerId && targetId === viewerId;

  return (
    <section className="max-w-4xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{viewingSelf ? 'Your Badges' : 'Badges'}</h1>
        {targetId && (
          <Link href={viewingSelf ? '/profile' : `/profiles/${targetId}`} className="text-sm underline">
            Back to profile
          </Link>
        )}
      </div>

      {msg && <p className="text-sm text-amber-700">{msg}</p>}
      {loading && <p className="text-sm text-gray-600">Loading…</p>}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {CATALOG.map((c) => {
          const earned = findEarned(c);
          const src = earned ? iconFor(earned) : c.defaultIcon;
          const when = earned?.earned_at ? new Date(earned.earned_at).toLocaleDateString() : null;

          return (
            <div
              key={`${c.track}-${c.tier}-${c.badge_code}`}
              className={`rounded border p-3 flex flex-col items-center text-center ${
                earned ? 'bg-white' : 'bg-gray-50'
              }`}
            >
              <img
                src={src}
                alt={c.title}
                className={`h-16 w-16 object-contain ${earned ? '' : 'opacity-60'}`}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = c.defaultIcon;
                }}
              />
              <div className="mt-2 text-sm font-medium">{c.title}</div>
              {earned ? (
                <div className="text-xs text-gray-600">Earned {when}</div>
              ) : (
                <div className="text-xs text-gray-500">Locked</div>
              )}
              <div className="mt-1 text-[11px] leading-snug text-gray-600">{c.howTo}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
