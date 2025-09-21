// /app/offers/mine/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { Offer } from '@/components/OfferCard'

export default function MyOffersPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [offers, setOffers] = useState<Offer[]>([])
  const [status, setStatus] = useState('')

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.replace('/sign-in')
        return
      }
      setUserId(user.id)
      await refresh(user.id)
    })()
  }, [])

  async function refresh(uid: string) {
    const { data } = await supabase
      .from('offers')
      .select('*')
      .eq('owner_id', uid)
      .order('created_at', { ascending: false })
    setOffers((data ?? []) as any)
  }

  async function toggleStatus(o: Offer) {
    const next = o.status === 'active' ? 'paused' : 'active'
    setStatus(`Updating "${o.title}"…`)
    const { error } = await supabase.from('offers').update({ status: next }).eq('id', o.id)
    if (error) setStatus(`Error: ${error.message}`)
    else {
      setStatus('Updated.')
      if (userId) await refresh(userId)
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold">My Offers</h2>
      {status && <p className="text-sm">{status}</p>}

      {offers.length === 0 ? (
        <p>You have no offers yet. <a className="underline" href="/offers/new">Create one</a>.</p>
      ) : (
        <div className="space-y-3">
          {offers.map(o => (
            <div key={o.id} className="rounded border p-3 bg-white flex items-start justify-between">
              <div>
                <div className="font-semibold">{o.title}</div>
                <div className="text-xs text-gray-600">
                  {o.offer_type} • {o.is_online ? 'Online' : [o.city, o.country].filter(Boolean).join(', ')}
                </div>
                <div className="text-xs mt-1">Status: <span className="font-mono">{o.status}</span></div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => toggleStatus(o)} className="rounded border px-3 py-2 text-sm">
                  {o.status === 'active' ? 'Pause' : 'Activate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
