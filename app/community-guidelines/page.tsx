// app/community-guidelines/page.tsx
'use client';

import Link from 'next/link';

export default function CommunityGuidelinesPage() {
  return (
    <main className="min-h-[80vh] bg-white">
      <section className="hx-section hx-section--brand">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:py-16 text-white">
          <h1 className="text-center text-3xl font-bold">Community Guidelines</h1>
          <p className="mx-auto mt-3 max-w-3xl text-center text-white/90">
            Harmonic Exchange is a gift-first experiment. These guidelines protect the safety,
            dignity, and joy of everyone participating.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-10">
        <div className="hx-card p-6 sm:p-8">
          <h2 className="text-xl font-semibold">Core principles</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-[var(--hx-ink)]">
            <li>Honor consent, boundaries, and safety—always.</li>
            <li>Use clear, kind communication and confirm mutual fit before meeting.</li>
            <li>No quid-pro-quo or debt tracking; this is not bartering or a marketplace for money.</li>
            <li>Share honestly about capacity and expectations. It’s okay to say no.</li>
            <li>Protect privacy. Don’t share others’ information without permission.</li>
            <li>Celebrate completion—share gratitude if you wish.</li>
          </ul>

          <h2 className="mt-8 text-xl font-semibold">What isn’t allowed</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-[var(--hx-ink)]">
            <li>Requests for money, tips, or paid upgrades.</li>
            <li>Harassment, discrimination, or hateful content of any kind.</li>
            <li>Illegal, dangerous, or adult content/services.</li>
            <li>Spam or deceptive behavior.</li>
          </ul>

          <h2 className="mt-8 text-xl font-semibold">Reporting & moderation</h2>
          <p className="mt-2 text-[var(--hx-muted)]">
            If something feels off, stop the interaction and{' '}
            <Link href="/profile" className="hx-link">contact the admins</Link>. We may pause access,
            remove content, or take other actions to keep the community safe.
          </p>

          <p className="mt-6 text-sm text-[var(--hx-muted)]">
            Last updated {new Date().toLocaleDateString()} — this is a living document and may evolve
            with the community’s needs.
          </p>
        </div>

        <div className="mt-6 flex justify-center gap-3">
          <Link href="/" className="hx-btn hx-btn--secondary">← Back home</Link>
          <Link href="/sign-in" className="hx-btn hx-btn--outline-primary">Join the Community</Link>
        </div>
      </section>
    </main>
  );
}
