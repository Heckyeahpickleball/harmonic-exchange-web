/* HX v0.6 — 2025-09-21 — My Offers selects images for thumbnails
   File: app/offers/mine/page.tsx
*/
'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import OfferCard, { type OfferRow } from '@/components/OfferCard'

type Status = 'active' | 'paused' | 'archived' | 'blocked'
type MyOffer = OfferRow & { status: Status }

const STATUS_FILTERS: Array<{ id: 'all' | Status; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'paused', label: 'Paused' },
  { id: 'archived', label: 'Archived' },
  { id: 'blocked', label: 'Blocked' },
]

export default function MyOffersPage() {
  const [offers, setOffers] = useState<MyOffer[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]>(STATUS_FILTERS[0])
  const [msg, setMsg] = useState('')

  const visible = useMemo(
    () => (filter.id === 'all' ? offers : offers.filter(o => o.status === filter.id)),
    [offers, filter.id]
  )

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setOffers([]); return }

        const { data, error } = await supabase
          .from('offers')
          .select(`
            id, title, offer_type, is_online, city, country, images, status,
            offer_tags(tag_id, tags:tags(id,name))
          `)
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false })

        if (error) throw error

        const map = new Map<string, MyOffer>()
        for (const row of (data as any[]) ?? []) {
          const base: MyOffer = map.get(row.id) ?? {
            id: row.id,
            title: row.title,
            offer_type: row.offer_type,
            is_online: row.is_online,
            city: row.city,
            country: row.country,
            status: row.status as Status,
            images: row.images ?? [],
            tags: [] as { id: number; name: string }[],
          }
          const rowTags = (row.offer_tags ?? [])
            .map((r: any) => ({ id: r?.tag_id, name: r?.tags?.name }))
            .filter((t: any) => t.id && t.name)

          for (const t of rowTags) if (!base.tags!.some(x => x.id === t.id)) base.tags!.push(t)
          map.set(row.id, base)
        }
        setOffers(Array.from(map.values()))
      } catch (e: any) {
        console.error(e)
        setMsg(e?.message ?? 'Failed to load your offers.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  async function setStatus(id: string, next: Status) {
    setMsg('')
    try {
      setOffers(prev => prev.map(o => (o.id === id ? { ...o, status: next } : o)))
      const { error } = await supabase.from('offers').update({ status: next }).eq('id', id).select('id').single()
      if (error) throw error
    } catch (e: any) {
      console.error(e); setMsg(e?.message ?? 'Could not update status.')
    }
  }

  function ActionButtons({ o }: { o: MyOffer }) {
    if (o.status === 'blocked') return <div className="text-xs text-red-600">Blocked by admin</div>
    return (
      <div className="flex flex-wrap gap-2">
        {o.status === 'active' && (
          <>
            <button onClick={() => setStatus(o.id, 'paused')} className="rounded border px-2 py-1 text-sm hover:bg-gray-50">Pause</button>
            <button onClick={() => { if (confirm('Archive this offer?')) setStatus(o.id, 'archived') }} className="rounded border px-2 py-1 text-sm hover:bg-gray-50">Archive</button>
          </>
        )}
        {o.status === 'paused' && (
          <>
            <button onClick={() => setStatus(o.id, 'active')} className="rounded border px-2 py-1 text-sm hover:bg-gray-50">Resume</button>
            <button onClick={() => { if (confirm('Archive this offer?')) setStatus(o.id, 'archived') }} className="rounded border px-2 py-1 text-sm hover:bg-gray-50">Archive</button>
          </>
        )}
        {o.status === 'archived' && (
          <button onClick={() => setStatus(o.id, 'active')} className="rounded border px-2 py-1 text-sm hover:bg-gray-50">Unarchive (Resume)</button>
        )}
      </div>
    )
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">My Offers</h2>
        <a href="/offers/new" className="rounded border px-3 py-1 text-sm hover:bg-gray-50">New Offer</a>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map(s => (
          <button key={s.id} onClick={() => setFilter(s)} className={`rounded px-3 py-1 text-sm border ${filter.id === s.id ? 'bg-gray-900 text-white' : 'hover:bg-gray-50'}`}>
            {s.label}
          </button>
        ))}
      </div>

      {msg && <p className="text-sm text-amber-700">{msg}</p>}
      {loading && <p className="text-sm text-gray-600">Loading…</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {visible.map(o => (
          <div key={o.id} className="space-y-2">
            <OfferCard offer={o} />
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">Status: <strong className={o.status === 'active' ? 'text-green-700' : 'text-gray-800'}>{o.status}</strong></span>
              <ActionButtons o={o} />
            </div>
          </div>
        ))}

        {!loading && visible.length === 0 && (
          <p className="text-sm text-gray-600">No offers in “{filter.label}”.</p>
        )}
      </div>
    </section>
  )
}
