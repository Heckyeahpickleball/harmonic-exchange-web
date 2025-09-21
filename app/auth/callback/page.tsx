'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function AuthCallback() {
  const params = useSearchParams()
  const code = params.get('code')
  const type = params.get('type') // 'recovery' for password reset links

  const [msg, setMsg] = useState('Finishing sign-in…')

  useEffect(() => {
    (async () => {
      try {
        if (!code) { setMsg('Missing code.'); return }
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) { setMsg(`Sign-in failed: ${error.message}`); return }
        if (type === 'recovery') {
          // user is now authenticated; let them set a new password
          window.location.replace('/reset-password')
        } else {
          window.location.replace('/profile')
        }
      } catch (err: any) {
        setMsg(`Sign-in failed: ${err?.message ?? String(err)}`)
      }
    })()
  }, [code, type])

  return (
    <section className="max-w-lg">
      <p>{msg}</p>
    </section>
  )
}
