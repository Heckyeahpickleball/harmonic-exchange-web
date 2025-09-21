'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function NotificationsBell() {
  const [count, setCount] = useState<number>(0)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setReady(true)
        return
      }

      // initial count
      const { count: c } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('profile_id', user.id)
        .is('read_at', null)
      setCount(c ?? 0)

      // realtime updates for this user's notifications
      channel = supabase
        .channel(`noti:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `profile_id=eq.${user.id}`,
          },
          async () => {
            const { count: c2 } = await supabase
              .from('notifications')
              .select('*', { count: 'exact', head: true })
              .eq('profile_id', user.id)
              .is('read_at', null)
            setCount(c2 ?? 0)
          }
        )
        .subscribe()
      setReady(true)
    }

    init()

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  if (!ready) return <span />

  return (
    <Link href="/inbox" className="relative inline-block">
      <span aria-label="Notifications" title="Notifications">🔔</span>
      {count > 0 && (
        <span className="absolute -right-2 -top-2 rounded-full bg-orange-400 px-1 text-xs font-semibold text-white">
          {count}
        </span>
      )}
    </Link>
  )
}
