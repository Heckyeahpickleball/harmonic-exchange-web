// app/badges/page.tsx
import { supabase } from '../../lib/supabaseClient';

type Row = {
  id: string;
  code: string;
  track: string;
  label: string | null;
  description?: string | null; // if you later add it
};

export const dynamic = 'force-static';

export default async function BadgesPage() {
  const { data, error } = await supabase
    .from('badges')
    .select('id, code, track, label')
    .order('track', { ascending: true })
    .order('code', { ascending: true });

  if (error) {
    // Don’t crash the build if the table is empty or RLS blocks it
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold">Badges</h1>
        <p className="mt-2 text-[var(--hx-muted)]">
          Couldn’t load badges yet. Please try again later.
        </p>
      </main>
    );
  }

  const badges = (data ?? []) as Row[];

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">Badges</h1>
      <p className="mt-2 text-[var(--hx-muted)]">
        Explore every badge and what it takes to earn it.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {badges.map((b) => (
          <article key={b.id} className="hx-card p-4">
            <div className="text-sm uppercase tracking-wide text-[var(--hx-muted)]">
              {b.track}
            </div>
            <div className="mt-1 text-lg font-semibold">{b.label ?? b.code}</div>
            <div className="mt-1 text-xs text-[var(--hx-muted)]">
              Code: <code>{b.code}</code>
            </div>
            {/* If/when you add a description field in the badges table, render it here */}
          </article>
        ))}
      </div>
    </main>
  );
}
