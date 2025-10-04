// app/badges/page.tsx
import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

export default async function BadgesGuidePage() {
  const { data: rows } = await supabase
    .from('badges')
    .select('code, track, label, requirement:meta->>requirement, icon:meta->>icon') // adjust if your JSON keys differ
    .order('track', { ascending: true })
    .order('code', { ascending: true });

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold">Badges & How to Earn Them</h1>
      <p className="mt-2 text-sm text-slate-600">
        Each badge celebrates milestones in giving, receiving, and participation.
      </p>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {(rows || []).map((b) => (
          <div key={b.code} className="hx-card p-4 flex gap-3 items-center">
            <img
              src={b.icon ?? '/badges/default.png'}
              alt={b.label}
              width={48}
              height={48}
              className="rounded-full ring-2 ring-amber-300/80"
            />
            <div className="min-w-0">
              <div className="font-semibold">{b.label}</div>
              <div className="text-xs text-slate-600">{b.track}</div>
              {b.requirement ? (
                <div className="mt-1 text-sm">
                  <span className="font-medium">How to earn: </span>{b.requirement}
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
