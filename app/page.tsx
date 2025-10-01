'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type HXUser = { id: string; email?: string | null } | null;

export default function HomePage() {
  const [user, setUser] = useState<HXUser>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!mounted) return;
        setUser(data.user ?? null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub?.subscription?.unsubscribe();
  }, []);

  return (
    <main className="min-h-[80vh]">
      {/* HERO — image only; no text/CTAs on top */}
      <section className="hx-hero" aria-label="Harmonic Exchange cover image">
        <h1 className="sr-only">Harmonic Exchange</h1>
      </section>

      {/* Intro + CTAs on a clean card */}
      <section>
        <div className="mx-auto max-w-6xl px-4">
          <div className="hx-cta-card">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-[var(--hx-ink)]">
                A gentler way to give and receive
              </h2>
              <p className="max-w-2xl text-[var(--hx-muted)]">
                Share what’s natural for you—time, presence, skills, creativity. When you need support, ask.
                No ledgers, no pressure. Just trust and mutual care.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/browse" className="hx-btn hx-btn--primary">Explore offerings</Link>

              {loading ? (
                <span className="hx-btn hx-btn--secondary">Checking…</span>
              ) : user ? (
                <>
                  <Link href="/offers/new" className="hx-btn hx-btn--secondary">Share My Value</Link>
                  <Link href="/profile" className="hx-btn hx-btn--secondary">My space</Link>
                </>
              ) : (
                <Link href="/sign-in" className="hx-btn hx-btn--secondary">Join the community</Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Why it's special */}
      <section className="bg-[var(--hx-surface)]">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
          <h3 className="text-center text-2xl font-bold">Why Harmonic Exchange is different</h3>
          <p className="mx-auto mt-4 max-w-3xl text-center text-[var(--hx-muted)]">
            We’re building a gift-first culture. People offer what feels light and joyful for them, and others
            receive with dignity. It’s simple, human, and surprisingly powerful.
          </p>

          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            <Feature
              title="Gift-first energy"
              body="Offer what’s easy and joyful. Giving stays light, natural, and sustainable."
            />
            <Feature
              title="Dignity-centered"
              body="Receiving is welcomed. Needs are normal, and asking is a strength."
            />
            <Feature
              title="Trust over tally"
              body="No score-keeping. Balance comes from generosity, not obligation."
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section>
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
          <h3 className="text-center text-2xl font-bold">How it works</h3>

          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            <Step n="1" title="Share My Value" body="Create an offering with a short invitation and image." />
            <Step n="2" title="Be discoverable" body="People find your offering on Browse or your profile." />
            <Step n="3" title="Ask to Receive" body="When something calls to you, request support—no pressure." />
          </div>

          <div className="mt-8 flex justify-center gap-3">
            <Link href="/offers/new" className="hx-btn hx-btn--primary">Share My Value</Link>
            <Link href="/browse" className="hx-btn hx-btn--secondary">See offerings</Link>
          </div>
        </div>
      </section>

      {/* Agreements */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
          <h3 className="text-center text-2xl font-bold">Community agreements</h3>
          <ul className="mx-auto mt-6 max-w-3xl list-disc space-y-2 pl-6 text-[var(--hx-ink)]/80">
            <li>Honor consent, boundaries, and safety—always.</li>
            <li>Use clear, kind communication. Confirm mutual fit before meeting.</li>
            <li>Keep it human-scale. If money is requested, it doesn’t belong here.</li>
            <li>Celebrate completion—share a note of gratitude if you wish.</li>
          </ul>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 text-sm text-[var(--hx-muted)]">
          <span>© {new Date().getFullYear()} Harmonic Exchange</span>
          <div className="flex gap-4">
            <Link href="/browse" className="hx-link">Browse</Link>
            <Link href="/offers/new" className="hx-link">Share My Value</Link>
            <Link href="/profile" className="hx-link">My space</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

/* ——— presentational helpers ——— */

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="hx-card">
      <div className="p-5">
        <div className="mb-2 text-sm font-semibold text-[var(--hx-brand)]">{title}</div>
        <p className="text-[var(--hx-muted)]">{body}</p>
      </div>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="hx-card">
      <div className="p-5">
        <div className="mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--hx-brand)] text-xs font-semibold text-white">
          {n}
        </div>
        <div className="font-semibold">{title}</div>
        <p className="mt-1 text-[var(--hx-muted)]">{body}</p>
      </div>
    </div>
  );
}
