// /app/debug/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function DebugPage() {
  const [out, setOut] = useState<any>(null)

  useEffect(() => {
    (async () => {
      const [session, user] = await Promise.all([
        supabase.auth.getSession(),
        supabase.auth.getUser(),
      ])
      setOut({ session: session.data, user: user.data })
    })()
  }, [])

  return (
    <pre className="p-4 text-xs overflow-auto bg-gray-100 rounded">
      {JSON.stringify(out, null, 2) || 'Loading...'}
    </pre>
  )
}
