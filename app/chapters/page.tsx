'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
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

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);

      // Try to select status; if the column doesn't exist yet, fall back
      const { data, error } = await supabase
        .from('groups')
        .select('id,name,slug,city,country,status')
        .order('created_at', { ascending: false })
        .limit(50);

      // If status column is missing, PostgREST returns an error; do a narrower query
      let results: GroupRow[] = [];
      if (error?.message?.toLowerCase?.().includes('column') && error.message.includes('status')) {
        const fallback = await supabase
          .from('groups')
          .select('id,name,slug,city,country')
          .order('created_at', { ascending: false })
          .limit(50);
        results = (fallback.data as GroupRow[]) || [];
      } else {
        results = (data as GroupRow[]) || [];
      }

      if (!cancelled) {
        // Prefer active if present; otherwise show all
        const active = results.filter((g) => (g as any).status === 'active');
        setGroups(active.length ? active : results);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Local Chapters</h1>
        <Link href="/chapters/start" className="hx-btn hx-btn--primary">Start a Chapter</Link>
      </div>

      <p className="mt-3 text-[var(--hx-muted)]">
        Chapters are local circles that host shares, gatherings, and experiments. Anyone can start one with a few friends.
      </p>

      {loading ? (
        <p className="mt-8 text-sm text-gray-600">Loading…</p>
      ) : groups.length === 0 ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="hx-card p-5">
            <div className="font-semibold">No chapters yet</div>
            <p className="mt-1 text-[var(--hx-muted)]">Be the first to start one in your area.</p>
          </div>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {groups.map((g) => (
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
