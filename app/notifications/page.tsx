// /app/notifications/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Note = {
  id: string
  type: string
  data: any
  read_at: string | null
  created_at: string
}

export default function NotificationsPage() {
  const [uid, setUid] = useState<string | null>(null)
  const [items, setItems] = useState<Note[]>([])
  const [status, setStatus] = useState('')

  async function load(u: string) {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('profile_id', u)
      .order('created_at', { ascending: false })
      .limit(100)
    setItems((data ?? []) as any)
  }

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return window.location.replace('/sign-in')
      setUid(user.id)
      await load(user.id)
    })()
  }, [])

  async function markRead(id?: string) {
    if (!uid) return
    setStatus('Updating…')
    const q = supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('profile_id', uid)
    const { error } = id ? await q.eq('id', id) : await q.is('read_at', null)
    if (error) setStatus(`Error: ${error.message}`)
    else {
      setStatus('Done.')
      await load(uid)
    }
  }

  function label(n: Note) {
    if (n.type === 'request_received') return 'You received a new request'
    if (n.type === 'request_accepted') return 'Your request was accepted'
    if (n.type === 'request_declined') return 'Your request was declined'
    return 'Notification'
  }

  return (
    <section className="space-y-4 max-w-2xl">
      <h2 className="text-2xl font-bold">Notifications</h2>
      <div className="flex gap-2">
        <button onClick={() => markRead()} className="rounded border px-3 py-2 text-sm">
          Mark all read
        </button>
      </div>
      {status && <p className="text-sm">{status}</p>}

      {items.length === 0 ? (
        <p>No notifications yet.</p>
      ) : (
        <div className="space-y-2">
          {items.map(n => (
            <div key={n.id} className="rounded border p-3 bg-white">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <span className="font-semibold">{label(n)}</span>
                  <span className="ml-2 text-xs text-gray-600">{new Date(n.created_at).toLocaleString()}</span>
                </div>
                {!n.read_at && (
                  <button onClick={() => markRead(n.id)} className="rounded border px-2 py-1 text-xs">
                    Mark read
                  </button>
                )}
              </div>
              {n.data?.offer_id && (
                <div className="text-xs mt-1">
                  <a className="underline" href={`/offers/${n.data.offer_id}`}>View offer</a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
