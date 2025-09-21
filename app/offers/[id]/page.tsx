// /app/offers/[id]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import type { Offer } from '@/components/OfferCard'

export default function OfferDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [offer, setOffer] = useState<Offer | null>(null)
  const [note, setNote] = useState('')
  const [status, setStatus] = useState('')
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const [{ data: offerData }, { data: { user } }] = await Promise.all([
        supabase.from('offers').select('*').eq('id', id).single(),
        supabase.auth.getUser(),
      ])
      setOffer(offerData as any)
      setUserId(user?.id ?? null)
    })()
  }, [id])

  async function sendRequest(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) return window.location.replace('/sign-in')
    if (!note.trim()) return setStatus('Please add a short note.')

    try {
      setStatus('Sending request…')
      const { error } = await supabase.rpc('create_request', { p_offer: id, p_note: note })
      if (error) throw error
      setStatus('Request sent! The owner was notified.')
      setNote('')
    } catch (err: any) {
      const msg = String(err?.message ?? err)
      if (/eligibility|active offer|row level security/i.test(msg)) {
        setStatus('You need at least 1 active offer before you can request. Create one under “New Offer”.')
      } else if (/duplicate key value violates unique constraint/i.test(msg)) {
        setStatus('You already have a pending request for this offer.')
      } else {
        setStatus(`Error: ${msg}`)
      }
    }
  }

  if (!offer) return <p>Loading…</p>

  const where = offer.is_online ? 'Online' : [offer.city, offer.country].filter(Boolean).join(', ')

  return (
    <section className="max-w-2xl space-y-4">
      <h2 className="text-2xl font-bold">{offer.title}</h2>
      <div className="text-sm text-gray-700">{offer.offer_type} • {where}</div>
      <p className="text-gray-800 whitespace-pre-wrap">{offer.description}</p>

      <hr className="my-4" />

      <form onSubmit={sendRequest} className="space-y-2">
        <label className="block text-sm font-medium">Send a short note with your request</label>
        <textarea
          className="w-full rounded border p-2"
          rows={4}
          placeholder="What do you need? Why would it be meaningful?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button className="rounded bg-black px-4 py-2 text-white">Request this Offer</button>
      </form>

      {status && <p className="text-sm">{status}</p>}
    </section>
  )
}
