// app/page.tsx
// Client-safe home page (no server-side Supabase call).
// Uses Tailwind only.

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

    async function load() {
      try {
        const { data } = await supabase.auth.getUser();
        if (!mounted) return;
        setUser(data.user ?? null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    // also listen for sign in/out so CTAs update live
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  return (
    <main className="min-h-[80vh]">
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-12 pb-10 sm:pt-16 sm:pb-14">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-gray-600">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              Live MVP
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
              Trade skills, services, and time — <span className="text-emerald-600">no money needed</span>.
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              Harmonic Exchange lets people post offers, request exchanges, and chat it through. A lightweight,
              community-first barter network.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/browse"
                className="rounded-2xl bg-black px-5 py-2.5 text-white shadow transition hover:shadow-md"
              >
                Browse offers
              </Link>

              {loading ? (
                <span className="rounded-2xl border px-5 py-2.5 text-gray-500">Checking…</span>
              ) : user ? (
                <>
                  <Link
                    href="/offers/new"
                    className="rounded-2xl border px-5 py-2.5 shadow-sm transition hover:bg-gray-50"
                  >
                    Create an offer
                  </Link>
                  <Link
                    href="/profile"
                    className="rounded-2xl border px-5 py-2.5 shadow-sm transition hover:bg-gray-50"
                  >
                    My profile
                  </Link>
                </>
              ) : (
                <Link
                  href="/sign-in"
                  className="rounded-2xl border px-5 py-2.5 shadow-sm transition hover:bg-gray-50"
                >
                  Sign in to start
                </Link>
              )}
            </div>
          </div>

          {/* Decorative card */}
          <div className="relative order-first h-64 overflow-hidden rounded-3xl border bg-gradient-to-br from-emerald-50 to-white p-4 md:order-last md:h-80">
            <div className="grid h-full grid-rows-3 gap-3">
              <div className="rounded-2xl bg-white/80 p-3 shadow-sm backdrop-blur">
                <div className="text-sm font-semibold">Recent exchange</div>
                <div className="mt-1 text-sm text-gray-600">Piano lesson ↔ Web help</div>
              </div>
              <div className="rounded-2xl bg-white/80 p-3 shadow-sm backdrop-blur">
                <div className="text-sm font-semibold">Trending offer</div>
                <div className="mt-1 text-sm text-gray-600">Resume review (remote)</div>
              </div>
              <div className="rounded-2xl bg-white/80 p-3 shadow-sm backdrop-blur">
                <div className="text-sm font-semibold">Local meetup</div>
                <div className="mt-1 text-sm text-gray-600">Bike tune-ups this weekend</div>
              </div>
            </div>
            <div className="pointer-events-none absolute -right-2 -top-2 h-24 w-24 rounded-full bg-emerald-200/40 blur-3xl" />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t bg-gray-50/60">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <h2 className="text-center text-2xl font-bold">How it works</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="mb-2 text-sm font-semibold text-emerald-600">1. Post an offer</div>
              <p className="text-gray-600">Share what you can provide — service, skill, or time. Add images and details.</p>
            </div>
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="mb-2 text-sm font-semibold text-emerald-600">2. Request a trade</div>
              <p className="text-gray-600">See something you need? Request it. Eligibility ensures everyone contributes.</p>
            </div>
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="mb-2 text-sm font-semibold text-emerald-600">3. Chat & exchange</div>
              <p className="text-gray-600">Use the inbox to confirm details and complete the exchange in person or online.</p>
            </div>
          </div>
          <div className="mt-8 flex justify-center">
            <Link
              href="/browse"
              className="rounded-2xl bg-emerald-600 px-5 py-2.5 font-medium text-white shadow transition hover:bg-emerald-700"
            >
              Explore the marketplace
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <div className="rounded-3xl border bg-white p-6 text-center shadow-sm sm:p-10">
          <h3 className="text-xl font-semibold">Ready to contribute and get help?</h3>
          <p className="mt-2 text-gray-600">
            Start by posting one offer. That unlocks requests and kicks off your reputation.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href="/offers/new"
              className="rounded-2xl bg-black px-5 py-2.5 text-white shadow transition hover:shadow-md"
            >
              Create an offer
            </Link>
            <Link
              href="/u/me"
              className="rounded-2xl border px-5 py-2.5 shadow-sm transition hover:bg-gray-50"
            >
              Go to my profile
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 text-sm text-gray-600">
          <span>© {new Date().getFullYear()} Harmonic Exchange</span>
          <div className="flex gap-4">
            <Link href="/browse" className="hover:underline">Browse</Link>
            <Link href="/my-offers" className="hover:underline">My Offers</Link>
            <Link href="/profile" className="hover:underline">Profile</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
