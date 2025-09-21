'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function NotificationsBell() {
  const [count, setCount] = useState<number>(0)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null
    let mounted = true

    const boot = async () => {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user) {
        if (mounted) setReady(true)
        return
      }

      const load = async () => {
        const { count } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('profile_id', user.id)
          .is('read_at', null)

        if (mounted) {
          setCount(count ?? 0)
          setReady(true)
        }
      }

      await load()

      // Subscribe to inserts/updates for my notifications
      channel = supabase
        .channel(`notifications-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `profile_id=eq.${user.id}`,
          },
          // simplest/most reliable: refetch count whenever anything changes
          () => load()
        )
        .subscribe()
    }

    void boot()

    return () => {
      mounted = false
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  if (!ready) return <span />

  return (
    <Link href="/notifications" className="relative inline-block">
      <span aria-label="Notifications" title="Notifications">🔔</span>
      {count > 0 && (
        <span className="absolute -right-2 -top-2 rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          {count}
        </span>
      )}
    </Link>
  )
}
