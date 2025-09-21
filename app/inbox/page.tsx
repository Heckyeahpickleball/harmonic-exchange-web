// /app/inbox/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type ReqRow = {
  id: string
  note: string
  status: 'pending' | 'accepted' | 'declined' | 'withdrawn' | 'fulfilled'
  created_at: string
  offer_id: string
  offers?: { id: string; title: string; owner_id?: string } | null
  requester_profile_id: string
}

export default function InboxPage() {
  const [tab, setTab] = useState<'received' | 'sent'>('received')
  const [uid, setUid] = useState<string | null>(null)
  const [received, setReceived] = useState<ReqRow[]>([])
  const [sent, setSent] = useState<ReqRow[]>([])
  const [status, setStatus] = useState('')

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return window.location.replace('/sign-in')
      setUid(user.id)
      await Promise.all([loadReceived(user.id), loadSent(user.id)])
    })()
  }, [])

  async function loadReceived(userId: string) {
    // requests for offers that I own
    const { data } = await supabase
      .from('requests')
      .select('id, note, status, created_at, offer_id, requester_profile_id, offers!inner(id, title, owner_id)')
      .eq('offers.owner_id', userId)
      .order('created_at', { ascending: false })
    setReceived((data ?? []) as any)
  }

  async function loadSent(userId: string) {
    const { data } = await supabase
      .from('requests')
      .select('id, note, status, created_at, offer_id, requester_profile_id, offers(id, title)')
      .eq('requester_profile_id', userId)
      .order('created_at', { ascending: false })
    setSent((data ?? []) as any)
  }

  async function respond(id: string, to: 'accepted' | 'declined') {
    if (!uid) return
    setStatus(`Updating…`)
    const { error } = await supabase.from('requests').update({ status: to }).eq('id', id)
    if (error) {
      setStatus(`Error: ${error.message}`)
    } else {
      setStatus(`Marked as ${to}.`)
      await Promise.all([loadReceived(uid), loadSent(uid)])
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold">Inbox</h2>
      <div className="flex gap-3 text-sm">
        <button
          className={`underline ${tab === 'received' ? 'font-semibold' : ''}`}
          onClick={() => setTab('received')}
        >
          Received
        </button>
        <button
          className={`underline ${tab === 'sent' ? 'font-semibold' : ''}`}
          onClick={() => setTab('sent')}
        >
          Sent
        </button>
      </div>

      {status && <p className="text-sm">{status}</p>}

      {tab === 'received' ? (
        received.length === 0 ? (
          <p>No requests received yet.</p>
        ) : (
          <div className="space-y-3">
            {received.map(r => (
              <div key={r.id} className="rounded border p-3 bg-white">
                <div className="text-sm">
                  <span className="font-semibold">{r.offers?.title}</span>
                  <span className="ml-2 text-xs px-2 py-1 rounded bg-gray-200">{r.status}</span>
                </div>
                <p className="text-sm mt-1">Note: {r.note}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    disabled={r.status !== 'pending'}
                    className="rounded border px-3 py-2 text-sm disabled:opacity-50"
                    onClick={() => respond(r.id, 'accepted')}
                  >
                    Accept
                  </button>
                  <button
                    disabled={r.status !== 'pending'}
                    className="rounded border px-3 py-2 text-sm disabled:opacity-50"
                    onClick={() => respond(r.id, 'declined')}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : sent.length === 0 ? (
        <p>You haven’t sent any requests yet.</p>
      ) : (
        <div className="space-y-3">
          {sent.map(r => (
            <div key={r.id} className="rounded border p-3 bg-white">
              <div className="text-sm">
                <span className="font-semibold">{r.offers?.title}</span>
                <span className="ml-2 text-xs px-2 py-1 rounded bg-gray-200">{r.status}</span>
              </div>
              <p className="text-sm mt-1">Your note: {r.note}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
