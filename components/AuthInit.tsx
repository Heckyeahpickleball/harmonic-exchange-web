// /components/AuthInit.tsx
'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function AuthInit() {
  useEffect(() => {
    const run = async () => {
      if (!window.location.hash) return
      const hash = new URLSearchParams(window.location.hash.slice(1))
      const access_token = hash.get('access_token')
      const refresh_token = hash.get('refresh_token')
      if (access_token && refresh_token) {
        await supabase.auth.setSession({ access_token, refresh_token })
        window.history.replaceState({}, '', window.location.pathname)
        window.location.replace('/profile')
      }
    }
    run()
  }, [])

  return null
}
