// /app/auth/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/components/AuthProvider';

type Mode = 'signin' | 'signup' | 'link';

export default function AuthPage() {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  useEffect(() => {
    if (user) setStatus('You are signed in.');
  }, [user]);

  async function onSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('Signing in…');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setStatus('Signed in!');
      window.location.href = '/profile';
    } catch (err: any) {
      setStatus(err?.message || 'Sign-in failed.');
    }
  }

  async function onSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('Creating account…');
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${origin}/auth/callback` },
      });
      if (error) throw error;
      setStatus('Check your email to confirm your account.');
    } catch (err: any) {
      setStatus(err?.message || 'Sign-up failed.');
    }
  }

  async function onMagicLink(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('Sending magic link…');
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${origin}/auth/callback` },
      });
      if (error) throw error;
      setStatus('Check your email for the magic link.');
    } catch (err: any) {
      setStatus(err?.message || 'Failed to send magic link.');
    }
  }

  async function onReset() {
    if (!email) {
      setStatus('Enter your email first.');
      return;
    }
    setStatus('Sending reset link…');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/auth/callback?type=recovery`,
      });
      if (error) throw error;
      setStatus('Check your email for a password reset link.');
    } catch (err: any) {
      setStatus(err?.message || 'Failed to send reset link.');
    }
  }

  return (
    <section className="max-w-md space-y-6">
      <h1 className="text-2xl font-bold">Welcome</h1>

      <div className="flex gap-3 text-sm">
        <button
          className={`underline ${mode === 'signin' ? 'font-semibold' : ''}`}
          onClick={() => setMode('signin')}
          type="button"
        >
          Sign in
        </button>
        <button
          className={`underline ${mode === 'signup' ? 'font-semibold' : ''}`}
          onClick={() => setMode('signup')}
          type="button"
        >
          Create account
        </button>
        <button
          className={`underline ${mode === 'link' ? 'font-semibold' : ''}`}
          onClick={() => setMode('link')}
          type="button"
        >
          Magic link
        </button>
      </div>

      {mode === 'signin' && (
        <form onSubmit={onSignIn} className="space-y-3">
          <input
            type="email"
            required
            placeholder="you@example.com"
            className="w-full rounded border p-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            required
            placeholder="Your password"
            className="w-full rounded border p-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="flex items-center justify-between">
            <button className="hx-btn hx-btn--primary">Sign in</button>
            <button type="button" onClick={onReset} className="text-xs underline">
              Forgot password?
            </button>
          </div>
        </form>
      )}

      {mode === 'signup' && (
        <form onSubmit={onSignUp} className="space-y-3">
          <input
            type="email"
            required
            placeholder="you@example.com"
            className="w-full rounded border p-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            required
            placeholder="Create a password"
            className="w-full rounded border p-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="hx-btn hx-btn--primary">Create account</button>
          <p className="text-xs text-gray-600">You may need to confirm your email before you can sign in.</p>
        </form>
      )}

      {mode === 'link' && (
        <form onSubmit={onMagicLink} className="space-y-3">
          <input
            type="email"
            required
            placeholder="you@example.com"
            className="w-full rounded border p-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="hx-btn hx-btn--primary">Send magic link</button>
        </form>
      )}

      {status && <p className="text-sm">{status}</p>}

      <div className="text-xs text-gray-500">
        Sessions persist across visits. Problems?{' '}
        <button
          className="underline"
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.href = '/auth';
          }}
        >
          sign out &amp; try again
        </button>
        .
      </div>

      <div>
        <Link href="/">← Back home</Link>
      </div>
    </section>
  );
}
