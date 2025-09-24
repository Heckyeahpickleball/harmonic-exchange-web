'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

type Row = {
  id: string
  profile_id: string
  type: 'request_received' | 'request_accepted' | 'request_declined' | 'system' | string
  data: any
  read_at: string | null
  created_at: string
}

export default function NotificationsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      try {
        const { data: sess } = await supabase.auth.getSession()
        const uid = sess.session?.user?.id
        if (!uid) { setRows([]); setLoading(false); return }

        await load(uid)

        // realtime refresh
        const channel = supabase
          .channel('notifications-page')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'notifications', filter: `profile_id=eq.${uid}` },
            () => load(uid)
          )
          .subscribe()

        if (!mounted) supabase.removeChannel(channel)
      } catch (e: any) {
        setMsg(e?.message ?? 'Failed to load notifications.')
      } finally {
        setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  async function load(uid: string) {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, profile_id, type, data, read_at, created_at')
      .eq('profile_id', uid)
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) throw error
    setRows((data ?? []) as Row[])
  }

  const unread = useMemo(() => rows.filter(r => !r.read_at), [rows])
  const read = useMemo(() => rows.filter(r => !!r.read_at), [rows])

  async function markAllRead() {
    setMsg('')
    const { data: sess } = await supabase.auth.getSession()
    const uid = sess.session?.user?.id
    if (!uid) return
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('profile_id', uid)
      .is('read_at', null)
    if (error) { setMsg(error.message); return }
    setRows(old => old.map(r => (r.read_at ? r : { ...r, read_at: now })))
  }

  async function markOneRead(id: string) {
    const now = new Date().toISOString()
    setRows(old => old.map(r => (r.id === id ? { ...r, read_at: now } : r)))
    const { error } = await supabase.from('notifications').update({ read_at: now }).eq('id', id)
    if (error) setMsg(error.message)
  }

  function renderText(n: Row) {
    const offerId = n.data?.offer_id as string | undefined
    const reqId = n.data?.request_id as string | undefined
    const message = n.data?.message as string | undefined

    switch (n.type) {
      case 'request_received':
        return (
          <>
            You received a request{offerId && <> for&nbsp;
              <Link href={`/offers/${offerId}`} className="underline">this offer</Link></>}
            .
          </>
        )
      case 'request_accepted':
        return (
          <>
            Your request was <strong>accepted</strong>
            {offerId && <> for&nbsp;<Link href={`/offers/${offerId}`} className="underline">this offer</Link></>}.
          </>
        )
      case 'request_declined':
        return (
          <>
            Your request was <strong>declined</strong>
            {offerId && <> for&nbsp;<Link href={`/offers/${offerId}`} className="underline">this offer</Link></>}.
          </>
        )
      default:
        return message ? message : 'System notification'
    }
  }

  return (
    <section className="max-w-3xl">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Notifications</h2>
        {unread.length > 0 && (
          <button onClick={markAllRead} className="rounded border px-3 py-1 text-sm hover:bg-gray-50">
            Mark all read
          </button>
        )}
      </div>

      {msg && <p className="mt-2 text-sm text-amber-700">{msg}</p>}
      {loading && <p className="mt-2 text-sm text-gray-600">Loading…</p>}

      {/* Unread first */}
      {unread.length > 0 && (
        <div className="mt-4 space-y-2">
          {unread.map(n => (
            <div key={n.id} className="rounded border p-3 bg-amber-50">
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm">{renderText(n)}</div>
                <button onClick={() => markOneRead(n.id)} className="text-xs underline">Mark read</button>
              </div>
              <div className="mt-1 text-[11px] text-gray-500">{new Date(n.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}

      {/* Read */}
      <div className="mt-6 space-y-2">
        {read.map(n => (
          <div key={n.id} className="rounded border p-3">
            <div className="text-sm">{renderText(n)}</div>
            <div className="mt-1 text-[11px] text-gray-500">{new Date(n.created_at).toLocaleString()}</div>
          </div>
        ))}
      </div>

      {!loading && rows.length === 0 && <p className="mt-4 text-sm text-gray-600">No notifications yet.</p>}
    </section>
  )
}
