'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type ReqStatus = 'pending'|'accepted'|'declined'|'withdrawn'|'fulfilled'

type RequestRow = {
  id: string
  offer_id: string
  requester_profile_id: string
  note: string
  status: ReqStatus
  created_at: string
}

export default function InboxPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'received'|'sent'>('received')
  const [me, setMe] = useState<string | null>(null)
  const [received, setReceived] = useState<RequestRow[]>([])
  const [sent, setSent] = useState<RequestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // load current user id, then requests
  useEffect(() => {
    let isMounted = true
    ;(async () => {
      setLoading(true)
      setError(null)
      const { data: u } = await supabase.auth.getUser()
      const uid = u.user?.id ?? null
      if (!isMounted) return
      setMe(uid)

      if (!uid) {
        setLoading(false)
        return
      }

      // Requests where I am the OFFER OWNER (received)
      const { data: rec, error: recErr } = await supabase
        .from('requests')
        .select('id, offer_id, requester_profile_id, note, status, created_at')
        // visible by policy when I own the offer
        .order('created_at', { ascending: false })

      if (recErr) setError(recErr.message)
      else setReceived((rec ?? []).filter(r => r)) // policy already limits rows

      // Requests I sent
      const { data: s, error: sErr } = await supabase
        .from('requests')
        .select('id, offer_id, requester_profile_id, note, status, created_at')
        .eq('requester_profile_id', uid)
        .order('created_at', { ascending: false })

      if (sErr) setError(sErr.message)
      else setSent(s ?? [])

      setLoading(false)
    })()

    return () => { isMounted = false }
  }, [])

  async function respond(reqId: string, next: Extract<ReqStatus,'accepted'|'declined'>) {
    const { error } = await supabase
      .from('requests')
      .update({ status: next })
      .eq('id', reqId)
    if (error) {
      alert(`Failed to update: ${error.message}`)
      return
    }
    // refresh lists
    router.refresh()
    setReceived(prev => prev.map(r => r.id === reqId ? {...r, status: next} : r))
  }

  const list = useMemo(() => tab === 'received' ? received : sent, [tab, received, sent])

  return (
    <section className="max-w-3xl space-y-4">
      <h2 className="text-2xl font-bold">Inbox</h2>

      <div className="flex gap-3 text-sm">
        <button
          onClick={() => setTab('received')}
          className={`underline ${tab==='received' ? 'font-semibold' : ''}`}
        >
          Received
        </button>
        <button
          onClick={() => setTab('sent')}
          className={`underline ${tab==='sent' ? 'font-semibold' : ''}`}
        >
          Sent
        </button>
      </div>

      {loading && <p>Loading…</p>}
      {error && <p className="text-red-600">Error: {error}</p>}
      {!loading && list.length === 0 && <p>No items.</p>}

      <ul className="space-y-3">
        {list.map((r) => (
          <li key={r.id} className="rounded border p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-sm text-gray-600">
                  {new Date(r.created_at).toLocaleString()}
                </div>
                <div className="text-sm">
                  Status: <span className="font-medium">{r.status}</span>
                </div>
                <div className="text-sm">
                  Note: {r.note || <em>(none)</em>}
                </div>
              </div>

              {/* ✅ ALWAYS link to the offer detail route /offers/[id] */}
              <div className="flex flex-col items-end gap-2">
                <Link
                  href={`/offers/${r.offer_id}`}
                  prefetch
                  className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
                >
                  View offer
                </Link>

                {tab === 'received' && r.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => respond(r.id, 'accepted')}
                      className="rounded bg-black px-3 py-1 text-white text-sm"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => respond(r.id, 'declined')}
                      className="rounded border px-3 py-1 text-sm"
                    >
                      Decline
                    </button>
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {!me && (
        <p className="text-sm text-gray-600">
          You’re not signed in. <Link href="/sign-in" className="underline">Sign in</Link>
        </p>
      )}
    </section>
  )
}
