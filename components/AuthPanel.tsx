// /components/AuthPanel.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  sendMagicLink,
  signInWithProvider,
  signInWithEmail,
  signUpWithEmail,
} from '@/lib/auth';

export default function AuthPanel() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup' | 'magic'>('signin');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    setMsg(null);

    try {
      if (mode === 'magic') {
        await sendMagicLink(email); // throws on failure
        setMsg('Check your email for a sign-in link.');
      } else if (mode === 'signup') {
        const { pendingUrl } = await signUpWithEmail(email, pw); // throws on failure
        // Send new users to the "Waiting for authorization" page
        router.push(pendingUrl);
        return; // stop here; no success message needed
      } else {
        await signInWithEmail(email, pw); // throws on failure
        setMsg('Welcome back!');
      }
    } catch (e: any) {
      setErr(e?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    setErr(null);
    setMsg(null);
    try {
      const url = await signInWithProvider('google');
      if (url && typeof window !== 'undefined') window.location.assign(url);
    } catch (e: any) {
      setErr(e?.message ?? 'Google sign-in failed.');
    }
  }

  const tabBtn = (active: boolean) =>
    `rounded-full border px-3 py-1 text-sm ${active ? 'bg-gray-900 text-white' : 'hover:bg-gray-50'}`;

  return (
    <div className="mx-auto max-w-md">
      {/* Tabs */}
      <div className="mb-4 flex items-center justify-center gap-2 sm:justify-start">
        <button
          type="button"
          className={tabBtn(mode === 'signin')}
          onClick={() => setMode('signin')}
        >
          Email + Password
        </button>
        <button
          type="button"
          className={tabBtn(mode === 'signup')}
          onClick={() => setMode('signup')}
        >
          Create account
        </button>
        <button
          type="button"
          className={tabBtn(mode === 'magic')}
          onClick={() => setMode('magic')}
        >
          Magic link
        </button>
      </div>

      {/* Forms */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm text-gray-700">Email</label>
          <input
            type="email"
            required
            className="w-full rounded border px-3 py-2"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {mode !== 'magic' && (
          <div>
            <label className="mb-1 block text-sm text-gray-700">Password</label>
            <input
              type="password"
              required
              minLength={6}
              className="w-full rounded border px-3 py-2"
              placeholder="••••••••"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
            />
            {mode === 'signin' && (
              <div className="mt-2">
                <a href="/reset-password" className="text-sm text-teal-700 hover:underline">
                  Forgot your password?
                </a>
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-teal-700 px-3 py-2 text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {loading
            ? 'Please wait…'
            : mode === 'signup'
            ? 'Create account'
            : mode === 'magic'
            ? 'Send magic link'
            : 'Sign in'}
        </button>
      </form>

      <div className="my-4 h-px bg-gray-200" />

      {/* Providers: Google only */}
      <div className="grid grid-cols-1 gap-2">
        <button
          onClick={google}
          className="inline-flex w-full items-center justify-center gap-2 rounded border px-3 py-2 hover:bg-gray-50"
        >
          <svg aria-hidden className="h-4 w-4" viewBox="0 0 24 24">
            <path
              d="M21.35 11.1h-9.18v2.96h5.27c-.23 1.5-1.77 4.41-5.27 4.41-3.18 0-5.78-2.63-5.78-5.86s2.6-5.86 5.78-5.86c1.81 0 3.03.77 3.73 1.44l2.54-2.45C16.93 4.2 15 3.3 12.17 3.3 6.99 3.3 2.83 7.46 2.83 12.64s4.16 9.34 9.34 9.34c5.39 0 8.95-3.79 8.95-9.14 0-.61-.07-1.07-.17-1.74z"
              fill="currentColor"
            />
          </svg>
          Continue with Google
        </button>
      </div>

      {msg && <p className="mt-3 text-sm text-emerald-700">{msg}</p>}
      {err && <p className="mt-3 text-sm text-rose-700">{err}</p>}
    </div>
  );
}
