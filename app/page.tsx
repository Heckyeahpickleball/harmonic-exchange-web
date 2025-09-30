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
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-12 pb-10 sm:pt-16 sm:pb-14">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-gray-600">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              Community first • Gift-based
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
              Share your gifts. Receive with grace.
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              Harmonic Exchange isn’t about transactions. It’s a place to offer what’s natural for you—skills,
              presence, care, creativity—without keeping score. And when you need support, the community is here.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/browse"
                className="rounded-2xl bg-black px-5 py-2.5 text-white shadow transition hover:shadow-md"
              >
                Explore community offerings
              </Link>

              {loading ? (
                <span className="rounded-2xl border px-5 py-2.5 text-gray-500">Checking…</span>
              ) : user ? (
                <>
                  <Link
                    href="/offers/new"
                    className="rounded-2xl border px-5 py-2.5 shadow-sm transition hover:bg-gray-50"
                  >
                    Share a gift
                  </Link>
                  <Link
                    href="/profile"
                    className="rounded-2xl border px-5 py-2.5 shadow-sm transition hover:bg-gray-50"
                  >
                    My space
                  </Link>
                </>
              ) : (
                <Link
                  href="/sign-in"
                  className="rounded-2xl border px-5 py-2.5 shadow-sm transition hover:bg-gray-50"
                >
                  Join the community
                </Link>
              )}
            </div>
          </div>

          {/* Soft visual */}
          <div className="relative order-first h-64 overflow-hidden rounded-3xl border bg-gradient-to-br from-emerald-50 to-white p-4 md:order-last md:h-80">
            <div className="grid h-full grid-rows-3 gap-3">
              <Card title="A gift offered" text="Breathwork circle • Sundays on Zoom" />
              <Card title="Care received" text="Meal support for new parents" />
              <Card title="Creative spark" text="Songwriting listening hour" />
            </div>
            <div className="pointer-events-none absolute -right-2 -top-2 h-24 w-24 rounded-full bg-emerald-200/40 blur-3xl" />
          </div>
        </div>
      </section>

      {/* Principles */}
      <section className="border-t bg-gray-50/60">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <h2 className="text-center text-2xl font-bold">Our principles</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            <Principle
              title="Give freely"
              body="Offer what feels natural—time, listening, skills, art, knowledge—without expectation."
            />
            <Principle
              title="Receive openly"
              body="Ask when your soul needs or wants something. Let the community care for you."
            />
            <Principle
              title="No tally"
              body="We don’t track debts. Generosity and trust keep energy moving."
            />
          </div>
        </div>
      </section>

      {/* How it flows */}
      <section>
        <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <h2 className="text-center text-2xl font-bold">How it flows</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            <Step
              n="1"
              title="Create your offering"
              body="Write a short invitation. Add an image if you like. Hit “Share a gift.”"
            />
            <Step
              n="2"
              title="Be discoverable"
              body="Others can find your offering on Browse or your profile. You can also share your link."
            />
            <Step
              n="3"
              title="Ask when needed"
              body="When something calls to you, request support. We keep eligibility simple but non-transactional."
            />
          </div>

          <div className="mt-8 flex justify-center gap-3">
            <Link
              href="/offers/new"
              className="rounded-2xl bg-emerald-600 px-5 py-2.5 font-medium text-white shadow transition hover:bg-emerald-700"
            >
              Share a gift
            </Link>
            <Link
              href="/browse"
              className="rounded-2xl border px-5 py-2.5 shadow-sm transition hover:bg-gray-50"
            >
              See offerings
            </Link>
          </div>
        </div>
      </section>

      {/* Community agreements */}
      <section className="border-t bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <h2 className="text-center text-2xl font-bold">Community agreements</h2>
          <ul className="mx-auto mt-6 max-w-3xl list-disc space-y-2 pl-6 text-gray-700">
            <li>Honor consent, boundaries, and safety—always.</li>
            <li>Use clear, kind communication. Confirm mutual fit before meeting.</li>
            <li>Keep it human-scale. If money is requested, it doesn’t belong here.</li>
            <li>Celebrate completion—share a note of gratitude if you wish.</li>
          </ul>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 text-sm text-gray-600">
          <span>© {new Date().getFullYear()} Harmonic Exchange</span>
          <div className="flex gap-4">
            <Link href="/browse" className="hover:underline">Browse</Link>
            <Link href="/offers/new" className="hover:underline">Share a gift</Link>
            <Link href="/profile" className="hover:underline">My space</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

/* ——— tiny presentational helpers ——— */

function Card({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl bg-white/80 p-3 shadow-sm backdrop-blur">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-sm text-gray-600">{text}</div>
    </div>
  );
}

function Principle({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="mb-2 text-sm font-semibold text-emerald-600">{title}</div>
      <p className="text-gray-600">{body}</p>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white">
        {n}
      </div>
      <div className="font-semibold">{title}</div>
      <p className="mt-1 text-gray-600">{body}</p>
    </div>
  );
}
