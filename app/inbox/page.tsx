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

export default function InboxPage() {
  const [items, setItems] = useState<Notif[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')

  function announceChange() {
    // Tell the bell to refresh immediately
    window.dispatchEvent(new Event('notifications:changed'))
  }

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) setStatus(`Error: ${error.message}`)
    setItems((data ?? []) as Notif[])
    setLoading(false)
  }

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null

    ;(async () => {
      await load()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      channel = supabase.channel('notif-list')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `profile_id=eq.${user.id}`,
        }, () => load())
        .subscribe()
    })()

    return () => { if (channel) supabase.removeChannel(channel) }
  }, [])

  async function markOne(id: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
    if (error) setStatus(`Error: ${error.message}`)
    await load()
    announceChange()
  }

  async function markAll() {
    setStatus('Marking all read…')
    const { error } = await supabase.rpc('mark_all_notifications_read')
    if (error) setStatus(`Error: ${error.message}`)
    else setStatus('')
    await load()
    announceChange()
  }

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold">Notifications</h2>
      <div className="flex items-center gap-2">
        <button onClick={markAll} className="rounded border px-3 py-1 text-sm">Mark all read</button>
        {status && <span className="text-sm">{status}</span>}
      </div>

      {loading ? <p>Loading…</p> : (
        <div className="space-y-2">
          {items.map(n => (
            <div key={n.id} className={`rounded border p-3 ${n.read_at ? 'opacity-60' : ''}`}>
              <div className="flex items-center justify-between">
                <strong className="text-sm">
                  {n.type === 'request_received' && 'You received a new request'}
                  {n.type === 'request_accepted' && 'Your request was accepted'}
                  {n.type === 'request_declined' && 'Your request was declined'}
                  {!['request_received','request_accepted','request_declined'].includes(n.type) && n.type}
                </strong>
                {!n.read_at && (
                  <button onClick={() => markOne(n.id)} className="rounded border px-2 py-1 text-xs">
                    Mark read
                  </button>
                )}
              </div>
              <div className="mt-1 text-xs text-gray-600">
                {new Date(n.created_at).toLocaleString()}
              </div>
              {n.data?.offer_id && (
                <div className="mt-2">
                  <Link href={`/offers`} className="underline text-sm">View offer</Link>
                </div>
              )}
            </div>
          ))}
          {items.length === 0 && <p className="text-sm text-gray-600">No notifications.</p>}
        </div>
      )}
    </section>
  )
}
