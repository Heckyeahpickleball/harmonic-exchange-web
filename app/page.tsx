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
      {/* HERO — cover image (image already contains the title/subtitle) */}
      <section className="hx-hero">
        {/* Keep text for accessibility/SEO only */}
        <h1 className="sr-only">HARMONIC EXCHANGE</h1>
        <p className="sr-only">Exploring a new way of living through cooperation and mutual support</p>

        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 text-center">
          {/* CTA chip group only */}
          <div className="mt-2 flex flex-wrap justify-center gap-3 rounded-full bg-white/20 p-2 backdrop-blur-sm ring-1 ring-white/30">
            <Link href="/browse" className="hx-btn hx-btn--brand">
              Explore community offerings
            </Link>

            {loading ? (
              <span className="hx-btn hx-btn--ghost text-gray-600">Checking…</span>
            ) : user ? (
              <>
                <Link href="/offers/new" className="hx-btn hx-btn--ghost">
                  Share My Value
                </Link>
                <Link href="/profile" className="hx-btn hx-btn--ghost">
                  My space
                </Link>
              </>
            ) : (
              <Link href="/sign-in" className="hx-btn hx-btn--ghost">
                Join the community
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* What it is */}
      <section className="border-t bg-[var(--hx-surface)]">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <h2 className="text-center text-2xl font-bold">What it is</h2>
          <p className="mx-auto mt-4 max-w-3xl text-center text-[var(--hx-muted)]">
            Harmonic Exchange isn’t about transactions. It’s a place to offer what’s natural for you—skills,
            presence, care, creativity—without keeping score. And when you need support, the community is here.
          </p>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            <Principle
              title="Give freely"
              body="Offer what feels natural—time, listening, skills, art, knowledge—without expectation."
            />
            <Principle
              title="Receive openly"
              body="Ask when your soul needs or wants something. Let the community care for you."
            />
            <Principle title="No tally" body="We don’t track debts. Generosity and trust keep energy moving." />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section>
        <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <h2 className="text-center text-2xl font-bold">How it works</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            <Step n="1" title="Share My Value" body="Create an offering with a short invitation and image." />
            <Step
              n="2"
              title="Be discoverable"
              body="Others find your offering on Browse or your profile. You can share your link too."
            />
            <Step
              n="3"
              title="Ask to Receive"
              body="When something calls to you, request support. We keep eligibility simple but non-transactional."
            />
          </div>

          <div className="mt-8 flex justify-center gap-3">
            <Link href="/offers/new" className="hx-btn hx-btn--brand">
              Share My Value
            </Link>
            <Link href="/browse" className="hx-btn hx-btn--ghost">
              See offerings
            </Link>
          </div>
        </div>
      </section>

      {/* Community agreements */}
      <section className="border-t bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <h2 className="text-center text-2xl font-bold">Community agreements</h2>
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

/* ——— tiny presentational helpers ——— */

function Principle({ title, body }: { title: string; body: string }) {
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
