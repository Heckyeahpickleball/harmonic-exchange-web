// app/page.tsx

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type HXUser = { id: string; email?: string | null } | null;

/* ---------------- REVIEWS CAROUSEL ---------------- */
/** Matches columns in public.reviews_public */
type ReviewRow = {
  id: string;
  created_at: string;
  message: string | null;
  offer_title?: string | null;
  owner_name?: string | null;
  receiver_name?: string | null;
  owner_avatar_url?: string | null;
  receiver_avatar_url?: string | null;
};

async function fetchRows(): Promise<ReviewRow[]> {
  // Read from the public view (with avatars)
  const { data, error } = await supabase
    .from('reviews_public')
    .select(
      'id,created_at,message,offer_title,owner_name,receiver_name,owner_avatar_url,receiver_avatar_url'
    )
    .order('created_at', { ascending: false })
    .limit(25);

  if (error) throw error;
  return (data ?? []) as ReviewRow[];
}

function ReviewsCarousel() {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [i, setI] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const timerRef = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const list = await fetchRows();
        if (!cancelled) setRows(list);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || 'Failed to load reviews');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const startTimer = () => {
    if (!rows.length) return;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setI((p) => (p + 1) % rows.length);
    }, 5000);
  };

  useEffect(() => {
    startTimer();
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [rows.length]);

  const onMouseEnter = () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  const onMouseLeave = () => startTimer();

  const onTouchStart: React.TouchEventHandler<HTMLDivElement> = (e) => {
    touchStartX.current = e.touches[0].clientX;
    if (timerRef.current) window.clearInterval(timerRef.current);
  };
  const onTouchEnd: React.TouchEventHandler<HTMLDivElement> = (e) => {
    const startX = touchStartX.current;
    const endX = e.changedTouches[0].clientX;
    touchStartX.current = null;
    const dx = (startX ?? endX) - endX;
    const threshold = 40; // px
    if (Math.abs(dx) > threshold && rows.length > 1) {
      setI((p) => (dx > 0 ? (p + 1) % rows.length : (p === 0 ? rows.length - 1 : p - 1)));
    }
    startTimer();
  };

  const Header = () => (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-2xl font-bold tracking-tight text-[var(--hx-ink)]">
        Gratitude from Past Exchanges
      </h3>
      <Link href="/reviews" className="hx-btn hx-btn--primary">
        Past Exchanges
      </Link>
    </div>
  );

  return (
    <section aria-label="Community Gratitude" className="bg-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
        <Header />
        {loading ? (
          <div className="hx-card p-6">
            <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
            <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-gray-200" />
            <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-gray-200" />
          </div>
        ) : err ? (
          <div className="hx-card p-6">
            <p className="text-[var(--hx-muted)]">Couldn’t load reviews.</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="hx-card p-6">
            <p className="text-[var(--hx-muted)]">
              No public gratitude yet. Be the first to share after your next exchange!
            </p>
          </div>
        ) : (
          <div
            className="hx-card overflow-hidden transition-shadow hover:shadow-md"
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <div className="p-5 sm:p-6">
              <div className="text-sm text-[var(--hx-muted)]">
                {new Date(rows[i].created_at).toLocaleString()}
              </div>
              <div className="mt-1 font-semibold text-[var(--hx-ink)]">
                {rows[i].offer_title ?? 'An exchange'}
              </div>
              <p className="mt-2 text-[var(--hx-ink)]">
                {rows[i].message ?? '—'}
              </p>

              {/* name + avatar (prefer receiver) */}
              <div className="mt-4 flex items-center gap-3">
                {(() => {
                  const name =
                    rows[i].receiver_name ??
                    rows[i].owner_name ??
                    'Community member';
                  const avatar =
                    rows[i].receiver_avatar_url ??
                    rows[i].owner_avatar_url ??
                    null;

                  return (
                    <>
                      {avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={avatar}
                          alt={name ?? 'Member avatar'}
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-gray-200" />
                      )}
                      <div className="text-sm text-[var(--hx-muted)]">From {name}</div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
/* --------------------------------------------------- */

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
        <h1 className="sr-only">
          Harmonic Exchange — The Flow Economy Experiment
        </h1>
      </section>

      {/* CTA STRIP (keeps Past Exchanges button) */}
      <section className="hx-cta-strip">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-3 px-4 py-6">
          <Link href="/browse" className="hx-btn hx-btn--primary">
            Explore Offerings
          </Link>
          {loading ? (
            <span className="hx-btn hx-btn--outline-primary">Checking…</span>
          ) : user ? (
            <>
              <Link href="/offers/new" className="hx-btn hx-btn--outline-primary">
                New Offer
              </Link>
              <Link href="/profile" className="hx-btn hx-btn--outline-primary">
                Create Space
              </Link>
            </>
          ) : (
            <Link href="/sign-in" className="hx-btn hx-btn--outline-primary">
              Join the Community
            </Link>
          )}
          <Link href="#about" className="hx-btn hx-btn--secondary">
            About
          </Link>
          <Link href="#guidelines" className="hx-btn hx-btn--secondary">
            Community Guidelines
          </Link>
        </div>
      </section>

      {/* Welcome (centered) */}
      <section>
        <div className="mx-auto max-w-4xl px-4">
          <div className="hx-card p-6 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--hx-ink)]">
              Welcome to Harmonic Exchange: the Flow Economy Experiment
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-[var(--hx-muted)]">
              Harmonic Exchange is a post-currency, gift-first way of sharing
              value. People offer <strong> time</strong>, <strong> products</strong>,
              <strong> services</strong>, <strong> education</strong>,
              <strong> coaching</strong>, <strong> presence</strong>, and
              <strong> creativity</strong>. Everything is given freely and
              received with dignity.
            </p>
          </div>
        </div>
      </section>

      {/* Reviews carousel */}
      <ReviewsCarousel />

      {/* Wave ABOVE the Why section (white background) */}
      <WaveDivider />

      {/* “About the Movement” */}
      <section id="about" className="bg-white">
        <div className="mx-auto max-w-6xl px-4 pt-8 pb-10 sm:pt-10 sm:pb-12">
          <h3 className="text-center text-2xl font-bold">About the Movement</h3>
          <p className="mx-auto mt-3 max-w-3xl text-center text-[var(--hx-muted)]">
            Harmonic Exchange explores a world where human value flows
            freely—guided by resonance, trust, and mutual care. We’re
            prototyping a community-led, post-currency practice where people
            connect, offer, and receive without obligation or tallying.
          </p>
        </div>
      </section>

      {/* “Why” as a 2-column block on cream */}
      <section style={{ background: 'var(--hx-cream)' }}>
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-8 px-4 py-10 sm:grid-cols-2 sm:py-12">
          <div>
            <Image
              src="/section-people.png"
              alt="People connecting in harmony"
              width={900}
              height={900}
              className="hx-feather-img"
              priority
            />
          </div>

          <div>
            <h3 className="hx-heading-title text-2xl font-bold">
              Why Harmonic Exchange is different
            </h3>
            <div className="hx-heading-accent" />
            <p className="mt-4 mx-auto max-w-prose text-center font-semibold text-[var(--hx-muted)]">
              This isn’t bartering or transactional. It’s a flow economy where
              value is shared—not counted—and guided by resonance, trust, and
              intuitive reciprocity.
            </p>

            <div className="mt-6 space-y-4">
              <FeatureLine
                title="Gift-first energy"
                body="Offer what you feel called to share—products, services, time, education, coaching, presence, or art."
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
        </div>
      </section>

      {/* Wave BEFORE “How it works” */}
      <WaveDivider />

      {/* How it works */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 pt-8 pb-14 sm:pt-8 sm:pb-16">
          <h3 className="text-center text-2xl font-bold">How it works</h3>

          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            <Step
              n="1"
              title="Share My Value"
              body="Create an offering with a short description and image. Offerings can be time, products, services, education, coaching, presence, or creativity."
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
            <Link href="/offers/new" className="hx-btn hx-btn--primary">
              Share My Value
            </Link>
            <Link href="/browse" className="hx-btn hx-btn--outline-primary">
              See Offerings
            </Link>
          </div>
        </div>
      </section>

      {/* Community Guidelines — brand gradient */}
      <section id="guidelines" className="hx-section hx-section--brand">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
          <h3 className="text-center text-2xl font-bold text-white">
            Community Guidelines
          </h3>
          <ul className="mx-auto mt-6 max-w-3xl list-disc space-y-2 pl-6 text-white/90">
            <li>Honor consent, boundaries, and safety—always.</li>
            <li>Use clear, kind communication.</li>
            <li>Confirm mutual fit before meeting.</li>
            <li>If money is requested, it doesn’t belong here.</li>
            <li>Celebrate completion—share gratitude if you wish.</li>
          </ul>
          <p className="mx-auto mt-6 max-w-3xl text-center text-white/85">
            This is a living experiment. We learn by doing. Local and global
            chapters welcome you to participate, share updates, and help evolve
            the practice.
          </p>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 text-sm text-[var(--hx-muted)]">
          <span>© {new Date().getFullYear()} Harmonic Exchange</span>
          <div className="flex gap-4">
            <Link href="/browse" className="hx-link">
              Offerings
            </Link>
            <Link href="/offers/new" className="hx-link">
              Share My Value
            </Link>
            <Link href="/profile" className="hx-link">
              Create Space
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

/* ——— helpers ——— */
function WaveDivider() {
  return (
    <div className="hx-wave-wrap" aria-hidden="true">
      <svg
        className="hx-wave"
        viewBox="0 0 1200 140"
        preserveAspectRatio="xMidYMid meet"
        role="img"
      >
        <defs>
          <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--hx-brand)" />
            <stop offset="60%" stopColor="#11a39b" />
            <stop offset="100%" stopColor="#14b8a6" />
          </linearGradient>
        </defs>
        <path
          d="M0,80 C200,30 360,130 600,80 C840,30 1000,130 1200,80 L1200,140 L0,140 Z"
          fill="url(#g)"
          opacity="0.85"
        />
      </svg>
    </div>
  );
}

function FeatureLine({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-[var(--hx-card-border)] bg-white/80 p-4 shadow-sm backdrop-blur-sm">
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
