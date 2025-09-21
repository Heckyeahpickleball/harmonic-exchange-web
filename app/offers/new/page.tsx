// /app/offers/new/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Tag = { id: number; name: string }

export default function NewOfferPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [offerType, setOfferType] = useState<'product'|'service'|'time'|'knowledge'|'other'>('service')
  const [isOnline, setIsOnline] = useState(false)
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [tagsCsv, setTagsCsv] = useState('') // comma separated input
  const [status, setStatus] = useState('')

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.replace('/sign-in')
        return
      }
      setUserId(user.id)

      const { data: tags } = await supabase.from('tags').select('*').order('name')
      setAllTags(tags ?? [])
    })()
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) return

    try {
      setStatus('Creating offer…')

      // insert offer
      const { data: offer, error: offerErr } = await supabase
        .from('offers')
        .insert({
          owner_id: userId,
          title,
          description,
          offer_type: offerType,
          is_online: isOnline,
          city: isOnline ? null : (city || null),
          country: isOnline ? null : (country || null),
          status: 'active',
        })
        .select()
        .single()

      if (offerErr) throw offerErr

      // handle tags (optional)
      const cleaned = tagsCsv
        .split(',')
        .map(t => t.trim().toLowerCase())
        .filter(Boolean)

      if (cleaned.length > 0) {
        // upsert tags
        const toUpsert = cleaned.map(n => ({ name: n }))
        const { data: upserted, error: tagErr } = await supabase
          .from('tags')
          .upsert(toUpsert, { onConflict: 'name' })
          .select()
        if (tagErr) throw tagErr

        // map names -> ids
        const idMap = new Map<string, number>()
        ;(upserted ?? []).forEach(t => idMap.set(t.name.toLowerCase(), t.id))
        allTags.forEach(t => idMap.set(t.name.toLowerCase(), t.id)) // include existing

        const rows = cleaned
          .map(n => idMap.get(n))
          .filter((id): id is number => !!id)
          .map(tag_id => ({ offer_id: offer.id as string, tag_id }))

        if (rows.length) {
          const { error: otErr } = await supabase.from('offer_tags').insert(rows)
          if (otErr) throw otErr
        }
      }

      setStatus('Offer created! Redirecting…')
      setTimeout(() => window.location.replace('/offers/mine'), 600)
    } catch (err: any) {
      setStatus(`Error: ${err.message ?? String(err)}`)
    }
  }

  return (
    <section className="max-w-2xl space-y-4">
      <h2 className="text-2xl font-bold">New Offer</h2>
      <form onSubmit={handleCreate} className="space-y-3">
        <div>
          <label className="block text-sm font-medium">Title</label>
          <input className="w-full rounded border p-2" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>

        <div>
          <label className="block text-sm font-medium">Description</label>
          <textarea className="w-full rounded border p-2" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium">Type</label>
            <select className="w-full rounded border p-2" value={offerType} onChange={(e) => setOfferType(e.target.value as any)}>
              <option value="product">product</option>
              <option value="service">service</option>
              <option value="time">time</option>
              <option value="knowledge">knowledge</option>
              <option value="other">other</option>
            </select>
          </div>

          <div className="flex items-end gap-2">
            <input id="online" type="checkbox" checked={isOnline} onChange={(e) => setIsOnline(e.target.checked)} />
            <label htmlFor="online" className="text-sm">This is an online offer</label>
          </div>
        </div>

        {!isOnline && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium">City</label>
              <input className="w-full rounded border p-2" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium">Country</label>
              <input className="w-full rounded border p-2" value={country} onChange={(e) => setCountry(e.target.value)} />
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium">Tags (comma-separated)</label>
          <input className="w-full rounded border p-2" placeholder="healing, design, tutoring" value={tagsCsv} onChange={(e) => setTagsCsv(e.target.value)} />
          <p className="text-xs text-gray-600 mt-1">
            Existing tags: {allTags.map(t => t.name).slice(0, 12).join(', ')}{allTags.length > 12 ? '…' : ''}
          </p>
        </div>

        <button type="submit" className="rounded bg-black px-4 py-2 text-white">Create Offer</button>
      </form>

      {status && <p className="text-sm">{status}</p>}
    </section>
  )
}
