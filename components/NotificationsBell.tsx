'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function NotificationsBell() {
  const [count, setCount] = useState<number>(0)
  const [ready, setReady] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null

    ;(async () => {
      // 1) Get the current user
      const { data: userData } = await supabase.auth.getUser()
      const uid = userData?.user?.id ?? null
      setUserId(uid)

      if (!uid) {
        setReady(true)
        return
      }

      // 2) Get initial unread count
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('profile_id', uid)
        .is('read_at', null)

      if (!error) setCount(count ?? 0)

      // 3) Realtime: keep badge in sync
      channel = supabase
        .channel('notifications-bell')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `profile_id=eq.${uid}`,
          },
          (payload) => {
            const row = payload.new as { read_at: string | null }
            if (!row.read_at) setCount((c) => c + 1)
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `profile_id=eq.${uid}`,
          },
          (payload) => {
            const before = payload.old as { read_at: string | null }
            const after = payload.new as { read_at: string | null }
            if (!before.read_at && !!after.read_at) {
              setCount((c) => Math.max(0, c - 1))
            }
          }
        )
        .subscribe()
      setReady(true)
    })()

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  // If not ready, or no user, still render the bell (no badge).
  return (
    <Link href="/inbox" className="relative inline-block" aria-label="Notifications" title="Notifications">
      <span>🔔</span>
      {userId && ready && count > 0 && (
        <span className="absolute -right-2 -top-2 rounded-full bg-red-600 text-white text-[10px] leading-none px-1.5 py-0.5">
          {count}
        </span>
      )}
    </Link>
  )
}
