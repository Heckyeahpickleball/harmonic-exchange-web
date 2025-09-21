'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Noti = {
  id: string
  type: string
  data: Record<string, any>
  created_at: string
  read_at: string | null
}

export default function NotificationsPage() {
  const [items, setItems] = useState<Noti[]>([])
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState(false)

  async function load() {
    setLoading(true)
    const {
      data: { user },
      error: uerr,
    } = await supabase.auth.getUser()
    if (uerr || !user) {
      setItems([])
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('profile_id', user.id)
      .order('created_at', { ascending: false })

    if (!error && data) setItems(data as Noti[])
    setLoading(false)
  }

  async function markAllRead() {
    setMarking(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('profile_id', user.id)
      .is('read_at', null)

    setMarking(false)
    load()
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <button
          onClick={markAllRead}
          disabled={marking || loading}
          className="rounded border px-3 py-1 disabled:opacity-60"
        >
          {marking ? 'Marking…' : 'Mark all read'}
        </button>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : items.length === 0 ? (
        <p>No notifications.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((n) => (
            <li
              key={n.id}
              className={`rounded border p-3 ${n.read_at ? 'opacity-70' : ''}`}
            >
              <div className="text-sm text-gray-600">
                {new Date(n.created_at).toLocaleString()}
              </div>
              <div className="font-medium">{n.type.replace('_', ' ')}</div>
              {n.data?.message && <div className="text-sm">{n.data.message}</div>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
