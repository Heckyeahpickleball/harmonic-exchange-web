'use client';

import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';

type GroupRow = {
  id: string;
  name: string;
  slug: string | null;
  city: string | null;
  country: string | null;
  status?: string | null; // tolerate missing column
};

export default function ChaptersPage() {
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('groups')
        .select('id,name,slug,city,country,status')
        .order('created_at', { ascending: false })
        .limit(200);

      let results: GroupRow[] = [];
      if (error?.message?.toLowerCase?.().includes('column') && error.message.includes('status')) {
        const fallback = await supabase
          .from('groups')
          .select('id,name,slug,city,country')
          .order('created_at', { ascending: false })
          .limit(200);
        results = (fallback.data as GroupRow[]) || [];
      } else {
        results = (data as GroupRow[]) || [];
      }

      if (!cancelled) {
        const active = results.filter((g) => (g as any).status === 'active');
        setGroups(active.length ? active : results);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ====== Search & Relevance Ranking ======
  const filteredGroups = useMemo(() => {
    if (!query.trim()) return groups;

    const q = query.toLowerCase();

    // assign a score for relevance
    const scored = groups.map((g) => {
      const name = g.name?.toLowerCase() || '';
      const city = g.city?.toLowerCase() || '';
      const country = g.country?.toLowerCase() || '';
      const slug = g.slug?.toLowerCase() || '';

      let score = 0;
      if (name === q) score += 5;
      else if (name.startsWith(q)) score += 4;
      else if (name.includes(q)) score += 3;

      if (city.startsWith(q) || country.startsWith(q)) score += 2;
      if (slug.includes(q)) score += 1;

      return { ...g, score };
    });

    return scored
      .filter((g) => g.score > 0)
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  }, [groups, query]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-3xl font-bold">Local Chapters</h1>
        <Link href="/chapters/start" className="hx-btn hx-btn--primary w-full sm:w-auto text-center">
          Start a Chapter
        </Link>
      </div>

      <p className="mt-3 text-[var(--hx-muted)]">
        Chapters are local circles that host shares, gatherings, and experiments. Anyone can start one with a few friends.
      </p>

      {/* Search bar */}
      <div className="mt-6">
        <input
          type="text"
          placeholder="Search chapters by name, city, or country..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm shadow-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
        />
      </div>

      {/* Content grid */}
      {loading ? (
        <p className="mt-8 text-sm text-gray-600">Loading…</p>
      ) : filteredGroups.length === 0 ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="hx-card p-5">
            <div className="font-semibold">No matching chapters</div>
            <p className="mt-1 text-[var(--hx-muted)]">
              Try another city or keyword, or start a new chapter in your area.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {filteredGroups.map((g) => (
            <Link
              key={g.id}
              href={g.slug ? `/chapters/${g.slug}` : '#'}
              className={`hx-card p-5 ${g.slug ? 'hover:shadow' : 'opacity-60 cursor-not-allowed'}`}
              aria-disabled={!g.slug}
            >
              <div className="font-semibold">
                {g.city && g.country ? `${g.city}, ${g.country}` : g.name}
              </div>
              <p className="mt-1 text-[var(--hx-muted)]">
                {g.slug ? 'Open chapter' : 'Awaiting setup (missing slug)'}
              </p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
