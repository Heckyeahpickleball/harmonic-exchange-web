'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'

export default function NotificationsBell() {
  const [session, setSession] = useState<Session | null>(null)
  const [count, setCount] = useState<number>(0)
  const [ready, setReady] = useState(false)

  // initial session + first count
  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      setSession(data.session ?? null)
      setReady(true)
      const uid = data.session?.user?.id
      if (uid) await refreshCount(uid)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess)
      if (sess?.user) refreshCount(sess.user.id)
      else setCount(0)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  async function refreshCount(userId: string) {
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('profile_id', userId)
      .is('read_at', null)
    setCount(count ?? 0)
  }

  // realtime + polling fallback
  useEffect(() => {
    const uid = session?.user?.id
    if (!uid) return

    const channel = supabase
      .channel('notifications-bell')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `profile_id=eq.${uid}` },
        () => refreshCount(uid)
      )
      .subscribe()

    const timer = setInterval(() => refreshCount(uid), 20000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(timer)
    }
  }, [session?.user?.id])

  if (!ready) return <span />

  return (
    <Link href="/notifications" className="relative inline-block" aria-label="Notifications" title="Notifications">
      <span>🔔</span>
      {count > 0 && (
        <span className="absolute -right-2 -top-2 rounded-full bg-orange-500 text-white text-[10px] leading-none px-1.5 py-0.5">
          {Math.min(count, 9)}
        </span>
      )}
    </Link>
  )
}
