'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function AuthCallbackPage() {
  const [msg, setMsg] = useState('Finishing sign-in...')

  useEffect(() => {
    let isMounted = true

    ;(async () => {
      try {
        // --- Case A: New PKCE flow (?code=...)
        const url = new URL(window.location.href)
        const code = url.searchParams.get('code')

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error

          // Clean the URL then go to profile
          window.history.replaceState({}, '', '/')
          window.location.replace('/profile')
          return
        }

        // --- Case B: Legacy hash flow (#access_token=...&refresh_token=...)
        if (window.location.hash) {
          const params = new URLSearchParams(window.location.hash.slice(1))
          const access_token = params.get('access_token')
          const refresh_token = params.get('refresh_token')

          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            })
            if (error) throw error

            window.history.replaceState({}, '', '/')
            window.location.replace('/profile')
            return
          }
        }

        if (isMounted) setMsg('Nothing to do here. Try signing in again.')
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('Auth callback error:', err)
        if (isMounted) setMsg(`Sign-in failed: ${message}`)
      }
    })()

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <section className="max-w-lg">
      <h2 className="text-2xl font-bold mb-2">Harmonic Exchange</h2>
      <p>{msg}</p>
    </section>
  )
}
