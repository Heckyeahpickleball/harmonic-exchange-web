// /app/offers/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import OfferCard, { type Offer } from '@/components/OfferCard'

export default function OffersBrowsePage() {
  const [loading, setLoading] = useState(true)
  const [offers, setOffers] = useState<Offer[]>([])
  const [q, setQ] = useState('')
  const [type, setType] = useState<'all'|'product'|'service'|'time'|'knowledge'|'other'>('all')
  const [city, setCity] = useState('')
  const [onlineOnly, setOnlineOnly] = useState(false)

  async function load() {
    setLoading(true)
    let query = supabase.from('offers').select('*').eq('status', 'active').order('created_at', { ascending: false })

    if (q) query = query.ilike('title', `%${q}%`)
    if (type !== 'all') query = query.eq('offer_type', type)
    if (onlineOnly) query = query.eq('is_online', true)
    if (!onlineOnly && city) query = query.ilike('city', `%${city}%`)

    const { data } = await query.limit(50)
    setOffers((data ?? []) as any)
    setLoading(false)
  }

  useEffect(() => { load() }, []) // initial
  useEffect(() => { const id = setTimeout(load, 250); return () => clearTimeout(id) }, [q, type, city, onlineOnly])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold">Browse Offers</h2>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <input className="rounded border p-2" placeholder="Search title…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="rounded border p-2" value={type} onChange={(e) => setType(e.target.value as any)}>
          <option value="all">all types</option>
          <option value="product">product</option>
          <option value="service">service</option>
          <option value="time">time</option>
          <option value="knowledge">knowledge</option>
          <option value="other">other</option>
        </select>
        <input className="rounded border p-2" placeholder="City (optional)" value={city} onChange={(e) => setCity(e.target.value)} disabled={onlineOnly} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlineOnly} onChange={(e) => setOnlineOnly(e.target.checked)} />
          Online only
        </label>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : offers.length === 0 ? (
        <p>No offers found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {offers.map(o => <OfferCard key={o.id} offer={o} />)}
        </div>
      )}
    </section>
  )
}
