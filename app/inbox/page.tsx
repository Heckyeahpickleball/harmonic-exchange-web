'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Req = {
  id: string
  offer_id: string
  requester_profile_id: string
  status: 'pending' | 'accepted' | 'declined' | 'withdrawn' | 'fulfilled'
  note: string
  created_at: string
  offer?: { id: string; title: string; owner_id?: string }
  requester_name?: string
}

type Profile = { id: string; display_name: string }

export default function InboxPage() {
  const [me, setMe] = useState<string | null>(null)
  const [tab, setTab] = useState<'received' | 'sent'>('received')
  const [received, setReceived] = useState<Req[]>([])
  const [sent, setSent] = useState<Req[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      const uid = data.user?.id ?? null
      setMe(uid)
      if (!uid) return

      setLoading(true)
      try {
        // RECEIVED: join offers to filter on my owned offers; also pull offer title
        const { data: recRows, error: recErr } = await supabase
          .from('requests')
          .select('id,offer_id,requester_profile_id,status,note,created_at, offers!inner(id,title,owner_id)')
          .eq('offers.owner_id', uid)
          .order('created_at', { ascending: false })
        if (recErr) throw recErr

        // SENT: my requests, join offer for title
        const { data: sentRows, error: sentErr } = await supabase
          .from('requests')
          .select('id,offer_id,requester_profile_id,status,note,created_at, offers(id,title)')
          .eq('requester_profile_id', uid)
          .order('created_at', { ascending: false })
        if (sentErr) throw sentErr

        const rec: Req[] = (recRows as any[]).map(r => ({
          id: r.id, offer_id: r.offer_id, requester_profile_id: r.requester_profile_id,
          status: r.status, note: r.note, created_at: r.created_at,
          offer: { id: r.offers?.id, title: r.offers?.title, owner_id: r.offers?.owner_id }
        }))
        const snt: Req[] = (sentRows as any[]).map(r => ({
          id: r.id, offer_id: r.offer_id, requester_profile_id: r.requester_profile_id,
          status: r.status, note: r.note, created_at: r.created_at,
          offer: { id: r.offers?.id, title: r.offers?.title }
        }))

        // fetch requester names for received
        const requesterIds = Array.from(new Set(rec.map(r => r.requester_profile_id)))
        let names = new Map<string, string>()
        if (requesterIds.length) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id,display_name')
            .in('id', requesterIds)
          for (const p of (profs as Profile[]) ?? []) names.set(p.id, p.display_name)
        }
        setReceived(rec.map(r => ({ ...r, requester_name: names.get(r.requester_profile_id) })))
        setSent(snt)
      } catch (e: any) {
        console.error(e)
        setMsg(e?.message ?? 'Failed to load inbox.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const active = useMemo(() => (tab === 'received' ? received : sent), [tab, received, sent])

  async function doRespond(id: string, action: 'accept' | 'decline' | 'fulfilled') {
    setMsg('')
    try {
      // optimistic UI
      if (tab === 'received') {
        setReceived(prev => prev.map(r => (r.id === id
          ? { ...r, status: action === 'accept' ? 'accepted' : action === 'decline' ? 'declined' : 'fulfilled' }
          : r)))
      }
      const { error } = await supabase.rpc('respond_request', { p_request: id, p_action: action })
      if (error) throw error
    } catch (e: any) {
      console.error(e)
      setMsg(e?.message ?? 'Action failed')
    }
  }

  async function doWithdraw(id: string) {
    setMsg('')
    try {
      // optimistic UI
      if (tab === 'sent') {
        setSent(prev => prev.map(r => (r.id === id ? { ...r, status: 'withdrawn' } : r)))
      }
      const { error } = await supabase.rpc('withdraw_request', { p_request: id })
      if (error) throw error
    } catch (e: any) {
      console.error(e)
      setMsg(e?.message ?? 'Withdraw failed')
    }
  }

  return (
    <section className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Inbox</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setTab('received')}
            className={`rounded border px-3 py-1 text-sm ${tab === 'received' ? 'bg-gray-900 text-white' : 'hover:bg-gray-50'}`}
          >
            Received
          </button>
          <button
            onClick={() => setTab('sent')}
            className={`rounded border px-3 py-1 text-sm ${tab === 'sent' ? 'bg-gray-900 text-white' : 'hover:bg-gray-50'}`}
          >
            Sent
          </button>
        </div>
      </div>

      {msg && <p className="text-sm text-amber-700">{msg}</p>}
      {loading && <p className="text-sm text-gray-600">Loading…</p>}

      <ul className="space-y-3">
        {active.map(r => (
          <li key={r.id} className="rounded border p-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                {tab === 'received' ? (
                  <>
                    <div className="font-medium">
                      {r.requester_name || r.requester_profile_id} requested: <span className="underline">{r.offer?.title}</span>
                    </div>
                    <div className="text-xs text-gray-600">{new Date(r.created_at).toLocaleString()}</div>
                  </>
                ) : (
                  <>
                    <div className="font-medium">
                      You requested: <span className="underline">{r.offer?.title}</span>
                    </div>
                    <div className="text-xs text-gray-600">{new Date(r.created_at).toLocaleString()}</div>
                  </>
                )}
                <p className="mt-2 text-sm whitespace-pre-wrap">{r.note}</p>
                <div className="mt-2 text-xs">
                  Status:{' '}
                  <strong
                    className={
                      r.status === 'accepted' ? 'text-green-700' :
                      r.status === 'declined' ? 'text-red-700' :
                      r.status === 'withdrawn' ? 'text-gray-700' :
                      r.status === 'fulfilled' ? 'text-blue-700' :
                      'text-gray-900'
                    }
                  >
                    {r.status}
                  </strong>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 shrink-0">
                {tab === 'received' && r.status === 'pending' && (
                  <>
                    <button onClick={() => doRespond(r.id, 'accept')} className="rounded border px-3 py-1 text-sm hover:bg-gray-50">
                      Accept
                    </button>
                    <button onClick={() => doRespond(r.id, 'decline')} className="rounded border px-3 py-1 text-sm hover:bg-gray-50">
                      Decline
                    </button>
                  </>
                )}
                {tab === 'received' && r.status === 'accepted' && (
                  <button onClick={() => doRespond(r.id, 'fulfilled')} className="rounded border px-3 py-1 text-sm hover:bg-gray-50">
                    Mark Fulfilled
                  </button>
                )}
                {tab === 'sent' && r.status === 'pending' && (
                  <button onClick={() => doWithdraw(r.id)} className="rounded border px-3 py-1 text-sm hover:bg-gray-50">
                    Withdraw
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {!loading && active.length === 0 && (
        <p className="text-sm text-gray-600">Nothing here yet.</p>
      )}
    </section>
  )
}
