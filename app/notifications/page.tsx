'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type NotificationRow = {
  id: string
  type: string
  data: any
  read_at: string | null
  created_at: string
}

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null
    let mounted = true

    const boot = async () => {
      const { data } = await supabase.auth.getUser()
      const user = data.user
      if (!user) {
        setLoading(false)
        return
      }
      setUserId(user.id)

      const load = async () => {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('profile_id', user.id)
          .order('created_at', { ascending: false })

        if (error) {
          console.error(error)
        } else if (mounted) {
          setItems((data as NotificationRow[]) ?? [])
        }
        if (mounted) setLoading(false)
      }

      await load()

      channel = supabase
        .channel(`notifications-page-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `profile_id=eq.${user.id}`,
          },
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

  const markAllRead = async () => {
    if (!userId) return
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('profile_id', userId)
      .is('read_at', null)

    if (!error) {
      // optimistic local update; bell will also update via Realtime
      setItems(prev => prev.map(n => (n.read_at ? n : { ...n, read_at: now })))
    } else {
      alert(error.message)
    }
  }

  const markOneRead = async (id: string) => {
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('id', id)
      .is('read_at', null)

    if (!error) {
      setItems(prev => prev.map(n => (n.id === id ? { ...n, read_at: now } : n)))
    } else {
      alert(error.message)
    }
  }

  return (
    <main>
      <h1 className="text-xl font-semibold mb-4">Notifications</h1>

      <button
        onClick={markAllRead}
        className="mb-4 rounded border px-3 py-1 hover:bg-gray-50"
      >
        Mark all read
      </button>

      {loading && <p>Loading…</p>}

      {!loading && items.length === 0 && <p>No notifications yet.</p>}

      <div className="space-y-3">
        {items.map(n => (
          <div
            key={n.id}
            className="rounded border p-3 flex items-center justify-between"
          >
            <div className="text-sm">
              <div className="font-medium">
                {n.type === 'request_received' && 'You received a new request'}
                {n.type === 'request_accepted' && 'Your request was accepted'}
                {n.type === 'request_declined' && 'Your request was declined'}
                {n.type !== 'request_received' &&
                  n.type !== 'request_accepted' &&
                  n.type !== 'request_declined' &&
                  n.type}
              </div>
              <div className="text-xs text-gray-600">
                {new Date(n.created_at).toLocaleString()}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {n.data?.offer_id && (
                <a
                  href={`/offers/${n.data.offer_id}`}
                  className="text-sm underline"
                >
                  View offer
                </a>
              )}
              {!n.read_at && (
                <button
                  onClick={() => markOneRead(n.id)}
                  className="text-xs rounded border px-2 py-1 hover:bg-gray-50"
                >
                  Mark read
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
