'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function NotificationsBell() {
  const [ready, setReady] = useState(false)
  const [count, setCount] = useState<number>(0)
  const [channel, setChannel] = useState<ReturnType<typeof supabase.channel> | null>(null)

  // helper: recompute unread count
  async function recalcCount(userId: string) {
    const { count: c, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', userId)
      .is('read_at', null)

    if (!error && typeof c === 'number') setCount(c)
  }

  useEffect(() => {
    let mounted = true

    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!mounted || !user) { setReady(true); return }

      // initial count
      await recalcCount(user.id)

      // subscribe to inserts & updates for this user
      const ch = supabase
        .channel(`notif-${user.id}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `profile_id=eq.${user.id}`
        }, async () => {
          await recalcCount(user.id)
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') setReady(true)
        })

      setChannel(ch)

      // cleanup
      return () => { mounted = false; supabase.removeChannel(ch) }
    })()
  }, [])

  // expose a global helper the inbox page can call after "mark all read"
  useEffect(() => {
    // @ts-ignore
    window.__hxRecalcBell = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) await recalcCount(user.id)
    }
  }, [])

  if (!ready) return <span />

  return (
    <Link href="/inbox" className="relative inline-block">
      <span aria-label="Notifications" title="Notifications">🔔</span>
      {count > 0 && (
        <span className="absolute -right-2 -top-2 rounded-full bg-orange-400 px-2 py-0.5 text-xs text-white">
          {count}
        </span>
      )}
    </Link>
  )
}
