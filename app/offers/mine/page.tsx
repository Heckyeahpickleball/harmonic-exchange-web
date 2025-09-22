// /app/offers/mine/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import OfferCard, { type OfferRow } from '@/components/OfferCard'

export default function MyOffersPage() {
  const [offers, setOffers] = useState<OfferRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const user = (await supabase.auth.getUser()).data.user
        if (!user) return setOffers([])

        const { data, error } = await supabase
          .from('offers')
          .select('id,title,offer_type,is_online,city,country, offer_tags(tag_id, tags(name))')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false })
        if (error) throw error

        // fold tag rows
        const map = new Map<string, OfferRow>()
        for (const row of (data as any[]) ?? []) {
          const existing = map.get(row.id) ?? {
            id: row.id,
            title: row.title,
            offer_type: row.offer_type,
            is_online: row.is_online,
            city: row.city,
            country: row.country,
            tags: [] as { id: number; name: string }[],
          }
          const rowTags = (row.offer_tags ?? [])
            .map((r: any) => ({ id: r?.tag_id, name: r?.tags?.name }))
            .filter((t: any) => t.id && t.name)

          for (const t of rowTags) if (!existing.tags!.some(x => x.id === t.id)) existing.tags!.push(t)
          map.set(row.id, existing)
        }
        setOffers(Array.from(map.values()))
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold">My Offers</h2>
      {loading && <p className="text-sm text-gray-600">Loading…</p>}
      <div className="mt-2 grid gap-4 md:grid-cols-2">
        {offers.map(o => (
          <OfferCard key={o.id} offer={o} />
        ))}
        {!loading && offers.length === 0 && <p className="text-sm text-gray-600">You have no offers yet.</p>}
      </div>
    </section>
  )
}
