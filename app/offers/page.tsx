// app/offers/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import OfferCard from '@/components/OfferCard'
import TagMultiSelect from '@/components/TagMultiSelect'
import { fetchAllTags, type Tag } from '@/lib/tags'

type OfferRow = {
  id: string
  title: string
  offer_type: string
  is_online: boolean
  city: string | null
  country: string | null
  // denormalized
  tags?: string[]
}

const TYPES = ['all types', 'product', 'service', 'time', 'knowledge', 'other'] as const
type TypeFilter = typeof TYPES[number]

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
      const baseCols =
        'id,title,offer_type,is_online,city,country,offer_tags(tag_id,tags(name))'
      // When filtering by tags, we use inner join to restrict rows; otherwise left join to include all
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

      // Deduplicate (inner join can return multiple rows per offer)
      const map = new Map<string, OfferRow>()
      for (const row of data as any[]) {
        const ex = map.get(row.id) ?? {
          id: row.id,
          title: row.title,
          offer_type: row.offer_type,
          is_online: row.is_online,
          city: row.city,
          country: row.country,
          tags: [] as string[],
        }
        const tagList: string[] =
          (row.offer_tags ?? []).map((ot: any) => ot?.tags?.name).filter(Boolean)
        ex.tags = Array.from(new Set([...(ex.tags ?? []), ...tagList]))
        map.set(row.id, ex)
      }
      setOffers([...map.values()])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // load on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
    load()
  }, [])

  // Reload when filters change (debounce text a bit)
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
            <option key={t} value={t}>{t}</option>
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
          <input type="checkbox" checked={onlineOnly} onChange={e => setOnlineOnly(e.target.checked)} />
          Online only
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Filter by Tags</label>
        <TagMultiSelect
          allTags={allTags}
          value={selectedTags.filter(t => t.id > 0)} // filter-only uses existing tags
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
