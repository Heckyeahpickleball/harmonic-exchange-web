// /app/sign-in/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'

type Mode = 'signin' | 'signup'

export default function SignInPage() {
  const [mode, setMode] = useState<Mode>('signin')

  // common
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [alreadySignedIn, setAlreadySignedIn] = useState(false)

  // email+password
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // NAME (separate first/last) for signup
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')

  useEffect(() => {
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setAlreadySignedIn(!!session)
    })()
  }, [])

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setStatus('Signing in…')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    setStatus(error ? `Error: ${error.message}` : 'Signed in! Redirecting…')
    if (!error) window.location.href = '/profile'
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim()) {
      setStatus('Please enter your first and last name.')
      return
    }
    setBusy(true)
    setStatus('Creating account…')

    const display = `${firstName.trim()} ${lastName.trim()}`.replace(/\s+/g, ' ')

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback`,
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          display_name: display,
          full_name: display,
        },
      },
    })

    setBusy(false)
    if (error) setStatus(`Error: ${error.message}`)
    else setStatus('Account created. Check your email to confirm your address before signing in.')
  }

  async function sendResetLink() {
    if (!email) { setStatus('Enter your email first.'); return }
    setBusy(true)
    setStatus('Sending password reset link…')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/callback?type=recovery`,
    })
    setBusy(false)
    setStatus(error ? `Error: ${error.message}` : 'Check your email for a reset link.')
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] sm:min-h-screen bg-gradient-to-b from-white via-teal-50/60 to-white">
      <div className="mx-auto w-full max-w-6xl px-3 py-6 sm:px-6 sm:py-10">
        {/* Header (pill removed, spacing tightened) */}
        <div className="mb-5 sm:mb-8 text-center">
          <h1 className="mt-0 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Welcome
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Sign in or create an account to join the exchange.
          </p>
        </div>

        {/* Card */}
        <div className="mx-auto grid max-w-4xl grid-cols-1 items-stretch gap-6 sm:grid-cols-2">
          {/* Left: form card */}
          <div className="rounded-2xl border border-teal-100 bg-white/80 p-4 shadow-sm backdrop-blur-sm sm:p-6">
            {/* Already signed in notice */}
            {alreadySignedIn && (
              <div className="mb-4 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900">
                You’re already signed in.{' '}
                <Link href="/profile" className="underline">Go to Profile</Link>
                <button
                  className="ml-2 rounded border border-teal-300 px-2 py-1 text-xs text-teal-800 hover:bg-teal-50"
                  onClick={async () => { await supabase.auth.signOut(); location.reload() }}
                >
                  Sign Out
                </button>
              </div>
            )}

            {/* Forms */}
            <div className="mt-1">
              {mode === 'signin' && (
                <form onSubmit={handleSignIn} className="space-y-3 sm:space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">Email</label>
                    <input
                      type="email"
                      required
                      placeholder="you@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      autoComplete="email"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none ring-teal-500/30 transition focus:border-teal-600 focus:ring"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">Password</label>
                    <input
                      type="password"
                      required
                      placeholder="Your password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      autoComplete="current-password"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none ring-teal-500/30 transition focus:border-teal-600 focus:ring"
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={busy}
                        className="hx-btn hx-btn--primary disabled:opacity-60"
                      >
                        {busy ? 'Please wait…' : 'Sign in'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setMode('signup')}
                        className="rounded-full border border-teal-600 bg-white px-4 py-2 text-sm font-medium text-teal-700 transition hover:bg-teal-50"
                      >
                        Create account
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={sendResetLink}
                      className="text-xs font-medium text-teal-700 underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                </form>
              )}

              {mode === 'signup' && (
                <form onSubmit={handleSignUp} className="space-y-3 sm:space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">First name</label>
                      <input
                        type="text"
                        required
                        placeholder="Jane"
                        value={firstName}
                        onChange={e => setFirstName(e.target.value)}
                        autoComplete="given-name"
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none ring-teal-500/30 transition focus:border-teal-600 focus:ring"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">Last name</label>
                      <input
                        type="text"
                        required
                        placeholder="Doe"
                        value={lastName}
                        onChange={e => setLastName(e.target.value)}
                        autoComplete="family-name"
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none ring-teal-500/30 transition focus:border-teal-600 focus:ring"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">Email</label>
                    <input
                      type="email"
                      required
                      placeholder="you@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      autoComplete="email"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none ring-teal-500/30 transition focus:border-teal-600 focus:ring"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">Password</label>
                    <input
                      type="password"
                      required
                      placeholder="Create a password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      autoComplete="new-password"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none ring-teal-500/30 transition focus:border-teal-600 focus:ring"
                    />
                    <p className="mt-1 text-xs text-gray-500">Use at least 8 characters for a strong password.</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button type="submit" disabled={busy} className="hx-btn hx-btn--primary disabled:opacity-60">
                      {busy ? 'Please wait…' : 'Create account'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('signin')}
                      className="rounded-full border border-teal-600 bg-white px-4 py-2 text-sm font-medium text-teal-700 transition hover:bg-teal-50"
                    >
                      Back to sign in
                    </button>
                  </div>

                  <p className="text-xs text-gray-600">
                    You’ll receive a confirmation email. Please verify before signing in.
                  </p>
                </form>
              )}
            </div>

            {/* Status / errors */}
            {status && (
              <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900" role="status">
                {status}
              </div>
            )}

            {/* Helper row */}
            <div className="mt-4 text-xs text-gray-500">
              Sessions persist across visits. Problems?{' '}
              <button
                className="font-medium text-teal-700 underline"
                onClick={async () => {
                  await supabase.auth.signOut()
                  window.location.href = '/auth'
                }}
              >
                sign out & try again
              </button>
              .
            </div>
          </div>

          {/* Right: brand / art panel — centered better & larger copy */}
          <div className="relative hidden overflow-hidden rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-600 via-teal-500 to-teal-400 p-8 text-teal-50 shadow-sm sm:flex">
            <div className="relative z-10 m-auto w-full max-w-md text-left">
              <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">The Flow Economy</h2>
              <p className="mt-3 text-balance text-center text-base/7 text-teal-50/95 sm:text-[17px]">
                Join chapters, share offerings, and build momentum together. Your account works across
                Global Exchange, Local Chapters, and more.
              </p>
              <ul className="mx-auto mt-5 max-w-md space-y-3 text-base/7 text-teal-50/95">
                <li className="flex items-start gap-3">
                  <span className="mt-[8px] inline-block h-2 w-2 shrink-0 rounded-full bg-white/95" />
                  Give what & when you feel called to
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-[8px] inline-block h-2 w-2 shrink-0 rounded-full bg-white/95" />
                  Receive what brings you joy and abundance
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-[8px] inline-block h-2 w-2 shrink-0 rounded-full bg-white/95" />
                  Connect with other incredible people who care
                </li>
              </ul>
              <div className="mt-7 flex justify-center">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-medium text-white backdrop-blur transition hover:bg-white/20"
                >
                  ← Back home
                </Link>
              </div>
            </div>
            <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-10 -left-6 h-52 w-52 rounded-full bg-white/10 blur-2xl" />
          </div>
        </div>

        {/* Mobile back link */}
        <div className="mt-6 text-center sm:hidden">
          <Link href="/" className="text-sm font-medium text-teal-700 underline">
            ← Back home
          </Link>
        </div>
      </div>
    </div>
  )
}
