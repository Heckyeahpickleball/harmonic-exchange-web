'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

type Notif = {
  id: string
  type: string
  data: any
  read_at: string | null
  created_at: string
}

export default function NotificationsPage() {
  const [items, setItems] = useState<Notif[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const { data: userData } = await supabase.auth.getUser()
      const uid = userData?.user?.id
      if (!uid) {
        setItems([])
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('profile_id', uid)
        .order('created_at', { ascending: false })

      if (!error && data) setItems(data as Notif[])
      setLoading(false)
    })()
  }, [])

  async function markAllRead() {
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData?.user?.id
    if (!uid) return

    const nowIso = new Date().toISOString()
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: nowIso })
      .eq('profile_id', uid)
      .is('read_at', null)

    if (!error) {
      // optimistic update so the bell clears immediately
      setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: nowIso })))
    }
  }

  return (
    <section className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Notifications</h2>
        <button onClick={markAllRead} className="rounded border px-3 py-1 text-sm">
          Mark all read
        </button>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : items.length === 0 ? (
        <p>No notifications.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            // simple renderer; extend as needed per type
            const offerId = n.data?.offer_id as string | undefined
            const link = offerId ? `/offers/${offerId}` : '/offers'
            const title =
              n.type === 'request_received'
                ? 'You received a new request'
                : n.type === 'request_accepted'
                ? 'Your request was accepted'
                : n.type === 'request_declined'
                ? 'Your request was declined'
                : 'Notification'

            return (
              <li
                key={n.id}
                className={`rounded border p-3 ${n.read_at ? 'opacity-70' : 'bg-yellow-50'}`}
              >
                <div className="flex items-center justify-between">
                  <strong>{title}</strong>
                  <span className="text-xs">{new Date(n.created_at).toLocaleString()}</span>
                </div>
                <div className="mt-1">
                  <Link href={link} className="underline text-sm">
                    View offer
                  </Link>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
