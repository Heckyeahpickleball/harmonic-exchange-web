// /components/AuthPanel.tsx
'use client';

import { useState } from 'react';
import {
  sendMagicLink,
  signInWithProvider,
  signInWithEmail,
  signUpWithEmail,
} from '@/lib/auth';

export default function AuthPanel() {
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
        await signUpWithEmail(email, pw); // throws on failure
        setMsg('Account created. Check your email to confirm and then sign in.');
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

  async function provider(p: 'google' | 'github' | 'facebook' | 'apple') {
    setErr(null);
    setMsg(null);
    try {
      const url = await signInWithProvider(p);
      if (url && typeof window !== 'undefined') window.location.assign(url);
    } catch (e: any) {
      setErr(e?.message ?? 'OAuth sign-in failed.');
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl border bg-white p-4 shadow-sm">
      <div className="mb-4 flex gap-2">
        <button
          className={`rounded-full border px-3 py-1 text-sm ${mode === 'signin' ? 'bg-gray-900 text-white' : ''}`}
          onClick={() => setMode('signin')}
          type="button"
        >
          Sign in
        </button>
        <button
          className={`rounded-full border px-3 py-1 text-sm ${mode === 'signup' ? 'bg-gray-900 text-white' : ''}`}
          onClick={() => setMode('signup')}
          type="button"
        >
          Create account
        </button>
        <button
          className={`rounded-full border px-3 py-1 text-sm ${mode === 'magic' ? 'bg-gray-900 text-white' : ''}`}
          onClick={() => setMode('magic')}
          type="button"
        >
          Magic link
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm">Email</label>
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
            <label className="mb-1 block text-sm">Password</label>
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
                <a href="/reset-password" className="text-sm text-blue-700 hover:underline">
                  Forgot your password?
                </a>
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-emerald-700 px-3 py-2 text-white hover:bg-emerald-800 disabled:opacity-50"
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

      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => provider('google')} className="rounded border px-3 py-2 hover:bg-gray-50">
          Continue with Google
        </button>
        <button onClick={() => provider('github')} className="rounded border px-3 py-2 hover:bg-gray-50">
          Continue with GitHub
        </button>
        {/* Enable these if configured in Supabase */}
        {/* <button onClick={() => provider('facebook')} className="rounded border px-3 py-2 hover:bg-gray-50">Facebook</button>
        <button onClick={() => provider('apple')} className="rounded border px-3 py-2 hover:bg-gray-50">Apple</button> */}
      </div>

      {msg && <p className="mt-3 text-sm text-emerald-700">{msg}</p>}
      {err && <p className="mt-3 text-sm text-rose-700">{err}</p>}
    </div>
  );
}
