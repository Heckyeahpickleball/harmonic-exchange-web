'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [status, setStatus] = useState('')
  const [signedIn, setSignedIn] = useState(false)

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setSignedIn(!!session)
      if (!session) {
        setStatus('This link is invalid or expired. Go to Sign In and send a new reset link.')
      }
    })()
  }, [])

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) { setStatus('Password must be at least 6 characters.'); return }
    if (password !== confirm) { setStatus('Passwords do not match.'); return }
    setStatus('Updating password…')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) setStatus(`Error: ${error.message}`)
    else { setStatus('Password updated. Redirecting…'); window.location.replace('/profile') }
  }

  if (!signedIn) {
    return (
      <section className="max-w-md">
        <h2 className="text-2xl font-bold">Reset Password</h2>
        <p className="mt-2 text-sm">{status}</p>
      </section>
    )
  }

  return (
    <section className="max-w-md space-y-3">
      <h2 className="text-2xl font-bold">Set a new password</h2>
      <form onSubmit={handleUpdate} className="space-y-2">
        <input
          type="password" required placeholder="New password"
          value={password} onChange={e=>setPassword(e.target.value)}
          className="w-full rounded border p-2"
        />
        <input
          type="password" required placeholder="Confirm password"
          value={confirm} onChange={e=>setConfirm(e.target.value)}
          className="w-full rounded border p-2"
        />
        <button type="submit" className="rounded bg-black px-4 py-2 text-white">Save password</button>
      </form>
      {status && <p className="text-sm">{status}</p>}
    </section>
  )
}
