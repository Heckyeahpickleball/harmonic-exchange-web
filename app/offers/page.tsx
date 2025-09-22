// app/offers/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import OfferCard, { type OfferRow } from '@/components/OfferCard'
import TagMultiSelect from '@/components/TagMultiSelect'
import { fetchAllTags, type Tag } from '@/lib/tags'

const TYPES = ['all types', 'product', 'service', 'time', 'knowledge', 'other'] as const
type TypeFilter = (typeof TYPES)[number]

export default function BrowseOffersPage() {
  const [q, setQ] = useState('')
  const [type, setType] = useState<TypeFilter>('all types')
  const [city, setCity] = useState('')
  const [onlineOnly, setOnlineOnly] = useState(false)
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [selectedTags, setSelectedTags] = useState<Tag[]>([])
  const [offers, setOffers] = useState<OfferRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchAllTags().then(setAllTags).catch(console.error)
  }, [])

  const tagIds = useMemo(() => selectedTags.filter(t => t.id > 0).map(t => t.id), [selectedTags])

  async function load() {
    setLoading(true)
    try {
      const join = tagIds.length ? 'offer_tags!inner' : 'offer_tags'
      let query = supabase
        .from('offers')
        .select(`id,title,offer_type,is_online,city,country, ${join}(tag_id,tags(name))`)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (q.trim()) query = query.ilike('title', `%${q.trim()}%`)
      if (type !== 'all types') query = query.eq('offer_type', type)
      if (onlineOnly) query = query.eq('is_online', true)
      if (!onlineOnly && city.trim()) query = query.ilike('city', `%${city.trim()}%`)
      if (tagIds.length) query = query.in('offer_tags.tag_id', tagIds)

      const { data, error } = await query
      if (error) throw error

      // Deduplicate when inner-joining tags
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
        const rowTags: { id: number; name: string }[] = (row.offer_tags ?? [])
          .map((ot: any) => ({ id: ot?.tag_id, name: ot?.tags?.name }))
          .filter((t: any) => t.id && t.name)

        // merge and unique by id
        const merged = [...(existing.tags ?? []), ...rowTags].reduce(
          (acc, t) => (acc.some(x => x.id === t.id) ? acc : acc.concat(t)),
          [] as { id: number; name: string }[]
        )
        existing.tags = merged
        map.set(row.id, existing)
      }
      setOffers(Array.from(map.values()))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // initial + on filter change
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    const t = setTimeout(load, 200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, type, city, onlineOnly, tagIds.join(',')])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold">Browse Offers</h2>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <input
          placeholder="Search title…"
          value={q}
          onChange={e => setQ(e.target.value)}
          className="rounded border p-2"
        />

        <select
          value={type}
          onChange={e => setType(e.target.value as TypeFilter)}
          className="rounded border p-2"
        >
          {TYPES.map(t => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <input
          placeholder="City (optional)"
          value={city}
          onChange={e => setCity(e.target.value)}
          className="rounded border p-2"
          disabled={onlineOnly}
        />

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onlineOnly}
            onChange={e => setOnlineOnly(e.target.checked)}
          />
          Online only
        </label>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Filter by Tags</label>
        <TagMultiSelect
          allTags={allTags}
          value={selectedTags.filter(t => t.id > 0)}
          onChange={setSelectedTags}
          allowCreate={false}
          placeholder="Type to search tags, press Enter to add…"
        />
      </div>

      {loading && <p className="text-sm text-gray-600">Loading…</p>}

      <div className="mt-2 grid gap-4 md:grid-cols-2">
        {offers.map(o => (
          <OfferCard key={o.id} offer={o} />
        ))}
        {!loading && offers.length === 0 && (
          <p className="text-sm text-gray-600">No offers match those filters yet.</p>
        )}
      </div>
    </section>
  )
}
