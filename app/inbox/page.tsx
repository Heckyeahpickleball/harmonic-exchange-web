'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'

type Notif = {
  id: string
  type: string
  data: any
  read_at: string | null
  created_at: string
}

export default function NotificationsPage() {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<Notif[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('')

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setStatus('You must be signed in to view notifications.')
      setItems([])
      setLoading(false)
      return
    }
    setUserId(user.id)
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('profile_id', user.id)
      .order('created_at', { ascending: false })

    if (error) setStatus(`Error: ${error.message}`)
    else setItems(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function markAllRead() {
    if (!userId) return
    setStatus('Marking all as read…')

    // 1) update in DB
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .is('read_at', null)
      .eq('profile_id', userId)

    if (error) {
      setStatus(`Error: ${error.message}`)
      return
    }

    // 2) update UI immediately
    setItems(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })))
    setStatus('All caught up!')

    // 3) *** THIS IS THE IMPORTANT LINE ***
    ;(window as any).__hxRecalcBell?.()
  }

  async function markOneRead(id: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)

    if (!error) {
      setItems(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      ;(window as any).__hxRecalcBell?.()
    }
  }

  return (
    <section className="max-w-3xl space-y-4">
      <h2 className="text-2xl font-bold">Notifications</h2>

      <div className="flex items-center gap-3">
        <button
          onClick={markAllRead}
          className="rounded border px-3 py-1 text-sm"
        >
          Mark all read
        </button>
        {status && <span className="text-sm">{status}</span>}
      </div>

      {loading ? <p>Loading…</p> : (
        <ul className="space-y-2">
          {items.map(n => (
            <li key={n.id} className="rounded border p-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">
                  {n.type === 'request_received' && 'You received a new request'}
                  {n.type === 'request_accepted' && 'Your request was accepted'}
                  {n.type === 'request_declined' && 'Your request was declined'}
                  {n.type === 'system' && 'System message'}
                </div>
                <div className="text-xs mt-1">
                  <Link href={`/offers`}>View offer</Link>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!n.read_at && (
                  <button
                    onClick={() => markOneRead(n.id)}
                    className="rounded border px-2 py-1 text-xs"
                  >
                    Mark read
                  </button>
                )}
              </div>
            </li>
          ))}
          {items.length === 0 && <li className="text-sm text-gray-600">No notifications.</li>}
        </ul>
      )}
    </section>
  )
}
