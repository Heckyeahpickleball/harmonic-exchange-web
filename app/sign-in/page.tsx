'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'

type Mode = 'signin' | 'signup' | 'link' | 'phone'

export default function SignInPage() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [status, setStatus] = useState('')
  const [alreadySignedIn, setAlreadySignedIn] = useState(false)

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setAlreadySignedIn(!!session)
    })()
  }, [])

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setStatus('Signing in…')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setStatus(error ? `Error: ${error.message}` : 'Signed in! Redirecting…')
    if (!error) window.location.href = '/profile'
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setStatus('Creating account…')
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${location.origin}/auth/callback` }
    })
    if (error) setStatus(`Error: ${error.message}`)
    else setStatus('Check your email to confirm your account.')
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setStatus('Sending magic link…')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` }
    })
    setStatus(error ? `Error: ${error.message}` : 'Check your email for a magic link.')
  }

  async function handlePhone(e: React.FormEvent) {
    e.preventDefault()
    setStatus('Sending SMS code…')
    const { error } = await supabase.auth.signInWithOtp({ phone })
    setStatus(error ? `Error: ${error.message}` : 'Check your SMS for the code.')
  }

  async function sendResetLink() {
    if (!email) { setStatus('Enter your email first.'); return }
    setStatus('Sending password reset link…')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/callback?type=recovery`
    })
    setStatus(error ? `Error: ${error.message}` : 'Check your email for a reset link.')
  }

  return (
    <section className="max-w-md space-y-6">
      <h2 className="text-2xl font-bold">Sign In</h2>

      {alreadySignedIn && (
        <div className="rounded border p-3 space-x-2">
          <span>You’re already signed in.</span>
          <Link href="/profile" className="underline">Go to Profile</Link>
          <button
            className="ml-2 rounded border px-2 py-1 text-sm"
            onClick={async () => { await supabase.auth.signOut(); location.reload() }}
          >
            Sign Out
          </button>
        </div>
      )}

      <div className="flex gap-3 text-sm">
        <button className={`underline ${mode==='signin'?'font-semibold':''}`} onClick={() => setMode('signin')}>Email + Password</button>
        <button className={`underline ${mode==='signup'?'font-semibold':''}`} onClick={() => setMode('signup')}>Create account</button>
        <button className={`underline ${mode==='link'?'font-semibold':''}`} onClick={() => setMode('link')}>Email Link</button>
        <button className={`underline ${mode==='phone'?'font-semibold':''}`} onClick={() => setMode('phone')}>Phone</button>
      </div>

      {mode === 'signin' && (
        <form onSubmit={handleSignIn} className="space-y-2">
          <input
            type="email" required placeholder="you@example.com"
            value={email} onChange={e=>setEmail(e.target.value)}
            className="w-full rounded border p-2" />
          <input
            type="password" required placeholder="Your password"
            value={password} onChange={e=>setPassword(e.target.value)}
            className="w-full rounded border p-2" />
          <div className="flex items-center justify-between">
            <button type="submit" className="rounded bg-black px-4 py-2 text-white">Sign in</button>
            <button type="button" onClick={sendResetLink} className="text-xs underline">Forgot password?</button>
          </div>
        </form>
      )}

      {mode === 'signup' && (
        <form onSubmit={handleSignUp} className="space-y-2">
          <input type="email" required placeholder="you@example.com"
            value={email} onChange={e=>setEmail(e.target.value)}
            className="w-full rounded border p-2" />
          <input type="password" required placeholder="Create a password"
            value={password} onChange={e=>setPassword(e.target.value)}
            className="w-full rounded border p-2" />
          <button type="submit" className="rounded bg-black px-4 py-2 text-white">Create account</button>
          <p className="text-xs text-gray-600">If email confirmation is enabled, you’ll get a link before you can sign in.</p>
        </form>
      )}

      {mode === 'link' && (
        <form onSubmit={handleMagicLink} className="space-y-2">
          <input type="email" required placeholder="you@example.com"
            value={email} onChange={e=>setEmail(e.target.value)}
            className="w-full rounded border p-2" />
          <button type="submit" className="rounded bg-black px-4 py-2 text-white">Send Magic Link</button>
        </form>
      )}

      {mode === 'phone' && (
        <form onSubmit={handlePhone} className="space-y-2">
          <input type="tel" required placeholder="+16135550123"
            value={phone} onChange={e=>setPhone(e.target.value)}
            className="w-full rounded border p-2" />
          <button type="submit" className="rounded bg-black px-4 py-2 text-white">Send SMS Code</button>
        </form>
      )}

      {status && <p className="text-sm">{status}</p>}
      <p className="text-xs text-gray-500">Sessions persist — you won’t need to log in every visit.</p>
    </section>
  )
}
