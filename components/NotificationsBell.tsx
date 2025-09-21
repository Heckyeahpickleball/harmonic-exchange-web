'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

export default function NotificationsBell() {
  const [count, setCount] = useState<number>(0)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let ch: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    async function init() {
      // Get the current user once
      const { data: { user } } = await supabase.auth.getUser()
      const uid = user?.id ?? null

      // If not signed in, just render the bell without a badge
      if (!uid || cancelled) {
        setReady(true)
        return
      }

      async function refresh() {
        const { count: c } = await supabase
          .from('notifications')
          .select('id', { head: true, count: 'exact' })
          .eq('profile_id', uid)            // use the non-null uid
          .is('read_at', null)

        if (!cancelled) {
          setCount(c ?? 0)
          setReady(true)
        }
      }

      // Initial fetch
      await refresh()

      // Realtime updates for this user
      ch = supabase
        .channel('notif-bell')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `profile_id=eq.${uid}`, // safe: uid is a string
          },
          refresh
        )
        .subscribe()
    }

    init()

    return () => {
      cancelled = true
      if (ch) supabase.removeChannel(ch)
    }
  }, [])

  if (!ready) return null

  return (
    <Link href="/inbox" className="relative inline-block">
      <span aria-label="Notifications" title="Notifications">🔔</span>
      {count > 0 && (
        <span className="absolute -right-2 -top-2 rounded-full bg-orange-500 text-white text-[10px] px-1.5 py-[1px]">
          {count}
        </span>
      )}
    </Link>
  )
}
