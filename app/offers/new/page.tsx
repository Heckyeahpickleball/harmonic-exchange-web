// app/offers/new/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import TagMultiSelect from '@/components/TagMultiSelect'
import { fetchAllTags, ensureTagsExist, linkOfferTags, type Tag } from '@/lib/tags'
import { useRouter } from 'next/navigation'

type OfferType = 'product' | 'service' | 'time' | 'knowledge' | 'other'

export default function NewOfferPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [offerType, setOfferType] = useState<OfferType>('service')
  const [isOnline, setIsOnline] = useState(false)
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [selectedTags, setSelectedTags] = useState<Tag[]>([])
  const [status, setStatus] = useState<string>('')

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser()
      setUserId(data.user?.id ?? null)
      try {
        setAllTags(await fetchAllTags())
      } catch (e: any) {
        console.error(e)
      }
    })()
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) {
      setStatus('Please sign in first.')
      return
    }
    setStatus('Creating offer…')

    const insert = await supabase
      .from('offers')
      .insert({
        owner_id: userId,
        title,
        description,
        offer_type: offerType,
        is_online: isOnline,
        city: isOnline ? null : city || null,
        country: isOnline ? null : country || null,
        status: 'active',
      })
      .select('id')
      .single()

    if (insert.error || !insert.data) {
      setStatus(`Error: ${insert.error?.message ?? 'insert failed'}`)
      return
    }

    // Ensure tags exist, then link
    try {
      const tagNames = selectedTags.map(t => t.name)
      const ensured = await ensureTagsExist(tagNames)
      await linkOfferTags(insert.data.id, ensured.map(t => t.id))
    } catch (e: any) {
      console.error(e)
      setStatus(`Offer created but tagging failed: ${e.message ?? e}`)
      router.push('/offers/mine')
      return
    }

    setStatus('Offer created!')
    router.push('/offers/mine')
  }

  return (
    <section className="max-w-xl space-y-4">
      <h2 className="text-2xl font-bold">New Offer</h2>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium">Title</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            required
            className="w-full rounded border p-2"
            placeholder="Pickleball Coaching"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={4}
            className="w-full rounded border p-2"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium">Type</label>
            <select
              value={offerType}
              onChange={e => setOfferType(e.target.value as OfferType)}
              className="w-full rounded border p-2"
            >
              <option value="service">service</option>
              <option value="product">product</option>
              <option value="time">time</option>
              <option value="knowledge">knowledge</option>
              <option value="other">other</option>
            </select>
          </div>

          <div className="flex items-end gap-2">
            <input
              id="online"
              type="checkbox"
              checked={isOnline}
              onChange={e => setIsOnline(e.target.checked)}
            />
            <label htmlFor="online" className="text-sm">Online only</label>
          </div>
        </div>

        {!isOnline && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium">City</label>
              <input value={city} onChange={e => setCity(e.target.value)} className="w-full rounded border p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium">Country</label>
              <input value={country} onChange={e => setCountry(e.target.value)} className="w-full rounded border p-2" />
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Tags</label>
          <TagMultiSelect
            allTags={allTags}
            value={selectedTags}
            onChange={setSelectedTags}
            allowCreate
            placeholder="Add tags (e.g., coaching, design) and press Enter…"
          />
          <p className="mt-1 text-xs text-gray-500">These help others find your offer.</p>
        </div>

        <div className="flex gap-2">
          <button type="submit" className="rounded bg-black px-4 py-2 text-white">Create</button>
          <span className="text-sm text-gray-600">{status}</span>
        </div>
      </form>
    </section>
  )
}
