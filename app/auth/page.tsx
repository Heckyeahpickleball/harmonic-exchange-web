// /app/auth/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import AuthPanel from '@/components/AuthPanel';

export const metadata: Metadata = {
  title: 'Sign in — Harmonic Exchange',
  description:
    'Access Harmonic Exchange to trade skills, services, and creativity in a trust-based marketplace.',
};

export default function AuthPage() {
  return (
    <div className="relative">
      {/* Soft brand background + subtle glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-emerald-50 via-white to-white"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-48 bg-[radial-gradient(40rem_20rem_at_top,rgba(15,118,110,0.18),transparent)]"
      />

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-10 md:grid-cols-2 md:items-center lg:gap-16">
        {/* Left: headline / brand copy */}
        <div className="order-2 md:order-1">
          <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-teal-800 bg-white/80">
            <span className="inline-block h-2 w-2 rounded-full bg-teal-600" />
            Gift-based collaboration
          </div>

          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
            Welcome to <span className="text-teal-700">Harmonic Exchange</span>
          </h1>

          <p className="mt-3 max-w-prose text-[15px] leading-7 text-gray-700">
            Sign in to exchange skills, services, and creativity through generosity. Build trust, grow
            reputation, and make great things together.
          </p>

          <ul className="mt-6 space-y-2 text-sm text-gray-700">
            <li className="flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-teal-600" />
              People first — no ads, no fees.
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-teal-600" />
              Organize via local & global chapters.
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-teal-600" />
              Offers, requests, and gratitude to show impact.
            </li>
          </ul>

          <div className="mt-8 flex flex-wrap items-center gap-4 text-sm text-gray-600">
            <Link href="/about" className="hover:text-gray-900 underline-offset-2 hover:underline">
              Learn more
            </Link>
            <span aria-hidden className="hidden sm:inline">·</span>
            <Link
              href="/community-guidelines"
              className="hover:text-gray-900 underline-offset-2 hover:underline"
            >
              Community guidelines
            </Link>
          </div>
        </div>

        {/* Right: the themed auth card */}
        <div className="order-1 md:order-2">
          <div className="mx-auto w-full max-w-md rounded-2xl border bg-white/90 p-5 shadow-sm backdrop-blur hx-card">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Sign in</h2>
                <p className="text-sm text-gray-600">Use email & password or a magic link.</p>
              </div>
              <div className="hidden md:block rounded-full border px-3 py-1 text-xs text-teal-800 bg-white/80">
                Safe & private
              </div>
            </div>

            {/* Your client-side logic lives here */}
            <AuthPanel />

            <p className="mt-4 text-center text-xs text-gray-500">
              By continuing, you agree to our{' '}
              <Link href="/terms" className="text-teal-700 hover:underline">
                Terms
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="text-teal-700 hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </div>

          <div className="mx-auto mt-6 w-full max-w-md text-center text-xs text-gray-500">
            Protected by Supabase Auth · Passwordless supported
          </div>
        </div>
      </section>
    </div>
  );
}
