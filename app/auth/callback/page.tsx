// /app/auth/callback/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function AuthCallbackPage() {
  const [msg, setMsg] = useState('Finishing sign-in…')

  useEffect(() => {
    ;(async () => {
      try {
        const url = new URL(window.location.href)
        const sp = url.searchParams

        // 1) PKCE: /auth/callback?code=...
        const code = sp.get('code')
        if (code) {
          // IMPORTANT: pass a STRING, not an object
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
          setMsg('Signed in! Redirecting…')
          window.location.replace('/profile')
          return
        }

        // 2) Token hash style: /auth/callback?token_hash=...&type=magiclink|recovery|invite|email_change
        const token_hash = sp.get('token_hash')
        const type = sp.get('type') as 'magiclink' | 'recovery' | 'invite' | 'email_change' | null
        if (token_hash && type) {
          const { error } = await supabase.auth.verifyOtp({ token_hash, type })
          if (error) throw error
          setMsg('Signed in! Redirecting…')
          window.location.replace('/profile')
          return
        }

        // 3) Legacy implicit: /#access_token=...&refresh_token=...
        if (window.location.hash) {
          const hash = new URLSearchParams(window.location.hash.slice(1))
          const access_token = hash.get('access_token')
          const refresh_token = hash.get('refresh_token')
          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token })
            if (error) throw error
            window.history.replaceState({}, '', url.pathname)
            setMsg('Signed in! Redirecting…')
            window.location.replace('/profile')
            return
          }
        }

        setMsg('Nothing to do here. Try sending the sign-in link again.')
      } catch (err: any) {
        setMsg(`Sign-in failed: ${err?.message ?? String(err)}`)
      }
    })()
  }, [])

  return (
    <section className="max-w-lg">
      <h2 className="text-2xl font-bold mb-2">Harmonic Exchange</h2>
      <p>{msg}</p>
    </section>
  )
}
