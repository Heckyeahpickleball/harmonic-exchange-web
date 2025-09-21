// /app/sign-in/page.tsx
'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function SignInPage() {
  const [mode, setMode] = useState<'email' | 'phone'>('email')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [smsSent, setSmsSent] = useState(false)
  const [smsCode, setSmsCode] = useState('')
  const [status, setStatus] = useState('')

  async function signInWithEmail(e: React.FormEvent) {
    e.preventDefault()
    try {
      setStatus('Sending magic link…')
      // start clean just in case
      await supabase.auth.signOut()
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${location.origin}/auth/callback`, // IMPORTANT
        },
      })
      setStatus(error ? `Error: ${error.message}` : 'Check your email for a magic link (open it in the SAME browser).')
    } catch (err: any) {
      setStatus(`Error: ${err.message ?? String(err)}`)
    }
  }

  async function sendSms(e: React.FormEvent) {
    e.preventDefault()
    try {
      setStatus('Sending SMS code…')
      const { error } = await supabase.auth.signInWithOtp({
        phone,
        options: { shouldCreateUser: true },
      })
      if (error) throw error
      setSmsSent(true)
      setStatus('Code sent! Enter it below.')
    } catch (err: any) {
      setStatus(`Error: ${err.message ?? String(err)}`)
    }
  }

  async function verifySms(e: React.FormEvent) {
    e.preventDefault()
    try {
      setStatus('Verifying…')
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token: smsCode,
        type: 'sms',
      })
      if (error) throw error
      if (data?.session) {
        setStatus('Signed in! Redirecting…')
        location.replace('/profile')
        return
      }
      setStatus('Could not verify code. Try again.')
    } catch (err: any) {
      setStatus(`Error: ${err.message ?? String(err)}`)
    }
  }

  return (
    <section className="max-w-md space-y-4">
      <h2 className="text-2xl font-bold">Sign In</h2>

      <div className="flex gap-2 text-sm">
        <button className={`underline ${mode === 'email' ? 'font-semibold' : ''}`} onClick={() => { setMode('email'); setStatus('') }}>Email</button>
        <button className={`underline ${mode === 'phone' ? 'font-semibold' : ''}`} onClick={() => { setMode('phone'); setStatus('') }}>Phone</button>
      </div>

      {mode === 'email' ? (
        <form onSubmit={signInWithEmail} className="space-y-2">
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border p-2"
          />
          <button type="submit" className="rounded bg-black px-4 py-2 text-white">Send Magic Link</button>
        </form>
      ) : (
        <>
          {!smsSent ? (
            <form onSubmit={sendSms} className="space-y-2">
              <input
                type="tel"
                required
                placeholder="+16135550123"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded border p-2"
              />
              <button type="submit" className="rounded bg-black px-4 py-2 text-white">Send SMS Code</button>
            </form>
          ) : (
            <form onSubmit={verifySms} className="space-y-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="\d*"
                required
                placeholder="Enter 6-digit code"
                value={smsCode}
                onChange={(e) => setSmsCode(e.target.value)}
                className="w-full rounded border p-2 tracking-widest"
              />
              <button type="submit" className="rounded bg-black px-4 py-2 text-white">Verify &amp; Sign In</button>
            </form>
          )}
        </>
      )}

      {status && <p className="text-sm text-gray-700">{status}</p>}
      <p className="text-xs text-gray-500">After login, use the Profile link in the header.</p>
    </section>
  )
}
