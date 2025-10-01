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
      {/* HERO — image only */}
      <section className="hx-hero" aria-label="Harmonic Exchange cover image">
        <h1 className="sr-only">Harmonic Exchange — The Flow Economy Experiment</h1>
      </section>

      {/* CTA STRIP */}
      <section className="hx-cta-strip">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-3 px-4 py-6">
          <Link href="/browse" className="hx-btn hx-btn--primary">Explore Offerings</Link>
          {loading ? (
            <span className="hx-btn hx-btn--outline-primary">Checking…</span>
          ) : user ? (
            <>
              <Link href="/offers/new" className="hx-btn hx-btn--outline-primary">Share My Value</Link>
              <Link href="/profile" className="hx-btn hx-btn--outline-primary">Receive Support</Link>
            </>
          ) : (
            <Link href="/sign-in" className="hx-btn hx-btn--outline-primary">Join the Community</Link>
          )}
        </div>
      </section>

      {/* Welcome (centered) */}
      <section>
        <div className="mx-auto max-w-4xl px-4">
          <div className="hx-card p-6 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--hx-ink)]">
              Welcome to Harmonic Exchange — the Flow Economy Experiment
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-[var(--hx-muted)]">
              A movement exploring a post-currency, gift-first, resonance-based way of sharing value. Here, offerings
              may be <strong>time</strong>, <strong>products</strong>, <strong>services</strong>, <strong>presence</strong>,
              or <strong>creativity</strong>—given without obligation, and received with dignity.
            </p>
          </div>
        </div>
      </section>

      {/* Why it's different — TINTED LIST (not cards) */}
      <section className="hx-section hx-section--cool">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
          <h3 className="text-center text-2xl font-bold">Why Harmonic Exchange is different</h3>
          <p className="mx-auto mt-4 max-w-3xl text-center text-[var(--hx-cool-ink-muted)]">
            This isn’t bartering, and it’s not transactional. It’s a <em>flow economy</em>—value shared,
            not counted—guided by resonance, trust, and intuitive reciprocity.
          </p>

          <div className="mx-auto mt-8 grid max-w-4xl gap-4">
            <FeatureLine
              title="Gift-first energy"
              body="Offer what feels light, easy, and joyful—whether that’s a product, a service, time, presence, or art."
            />
            <FeatureLine
              title="Dignity-centered receiving"
              body="Needs are normal. Asking is a strength. Receiving is welcomed and respected."
            />
            <FeatureLine
              title="Trust over tally"
              body="No score-keeping or debt. Balance emerges through alignment and care."
            />
          </div>
        </div>
      </section>

      {/* How it works — CARDS so it contrasts the list above */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
          <h3 className="text-center text-2xl font-bold">How it works</h3>

          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            <Step
              n="1"
              title="Share My Value"
              body="Create an offering with a short description and image. Offerings can be time, products, services, presence, or creativity."
            />
            <Step
              n="2"
              title="Be discoverable"
              body="People find your offering through the Browse page or your profile. Share your link if you like."
            />
            <Step
              n="3"
              title="Ask to Receive"
              body="When something resonates, ask. There’s no pressure—only possibility."
            />
          </div>

          <div className="mt-8 flex justify-center gap-3">
            <Link href="/offers/new" className="hx-btn hx-btn--primary">Share My Value</Link>
            <Link href="/browse" className="hx-btn hx-btn--outline-primary">See Offerings</Link>
          </div>
        </div>
      </section>

      {/* Agreements — deep section */}
      <section className="hx-section hx-section--deep">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
          <h3 className="text-center text-2xl font-bold text-white">Community agreements</h3>
          <ul className="mx-auto mt-6 max-w-3xl list-disc space-y-2 pl-6 text-white/90">
            <li>Honor consent, boundaries, and safety—always.</li>
            <li>Use clear, kind communication.</li>
            <li>Confirm mutual fit before meeting.</li>
            <li>If money is requested, it doesn’t belong here.</li>
            <li>Celebrate completion—share gratitude if you wish.</li>
          </ul>
          <p className="mx-auto mt-6 max-w-3xl text-center text-white/80">
            This is a living experiment. We learn by doing. Local and global chapters welcome you to participate,
            share updates, and help evolve the practice.
          </p>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 text-sm text-[var(--hx-muted)]">
          <span>© {new Date().getFullYear()} Harmonic Exchange</span>
          <div className="flex gap-4">
            <Link href="/browse" className="hx-link">Offerings</Link>
            <Link href="/offers/new" className="hx-link">Share My Value</Link>
            <Link href="/profile" className="hx-link">Receive Support</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

/* ——— presentational helpers ——— */

function FeatureLine({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-[var(--hx-card-border)] bg-white/70 p-4 shadow-sm backdrop-blur-sm">
      <div className="flex gap-3">
        <div className="mt-1 h-5 w-1.5 shrink-0 rounded-full bg-[var(--hx-brand)]" />
        <div>
          <div className="font-semibold text-[var(--hx-ink)]">{title}</div>
          <p className="mt-0.5 text-[var(--hx-muted)]">{body}</p>
        </div>
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
