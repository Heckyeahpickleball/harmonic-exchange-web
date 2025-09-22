// /app/offers/new/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import TagMultiSelect from '@/components/TagMultiSelect'
import { fetchAllTags, ensureTagsExist, linkTagsToOffer, type Tag } from '@/lib/tags'

const TYPES = ['product', 'service', 'time', 'knowledge', 'other'] as const
type OfferType = (typeof TYPES)[number]

export default function NewOfferPage() {
  const router = useRouter()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [offerType, setOfferType] = useState<OfferType>('service')
  const [isOnline, setIsOnline] = useState(false)
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [selectedTags, setSelectedTags] = useState<Tag[]>([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetchAllTags().then(setAllTags).catch(console.error)
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMsg('')
    setSaving(true)
    try {
      const user = (await supabase.auth.getUser()).data.user
      if (!user) throw new Error('You must be signed in.')

      // 1) create the offer
      const { data: inserted, error } = await supabase
        .from('offers')
        .insert({
          owner_id: user.id,
          title,
          description,
          offer_type: offerType,
          is_online: isOnline,
          city: isOnline ? null : (city || null),
          country: isOnline ? null : (country || null),
          status: 'active',
        })
        .select('id')
        .single()
      if (error) throw error
      const offerId = inserted!.id as string

      // 2) upsert any new tags (client-created ones have negative ids)
      const desiredNames = selectedTags.map(t => t.name)
      const ensured = await ensureTagsExist(desiredNames)

      // 3) link tags to offer
      await linkTagsToOffer(offerId, ensured.map(t => t.id))

      setMsg('Offer created!')
      router.push('/offers/mine')
    } catch (err: any) {
      console.error(err)
      setMsg(err?.message ?? 'Failed to create offer.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="max-w-2xl space-y-4">
      <h2 className="text-2xl font-bold">New Offer</h2>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Title</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            required
            className="w-full rounded border p-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={5}
            className="w-full rounded border p-2"
          />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Type</label>
            <select
              value={offerType}
              onChange={e => setOfferType(e.target.value as OfferType)}
              className="w-full rounded border p-2"
            >
              {TYPES.map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="online"
              type="checkbox"
              checked={isOnline}
              onChange={e => setIsOnline(e.target.checked)}
            />
            <label htmlFor="online" className="text-sm">
              Online
            </label>
          </div>

          {!isOnline && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium">City</label>
                <input value={city} onChange={e => setCity(e.target.value)} className="w-full rounded border p-2" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Country</label>
                <input
                  value={country}
                  onChange={e => setCountry(e.target.value)}
                  className="w-full rounded border p-2"
                />
              </div>
            </>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Tags</label>
          <TagMultiSelect
            allTags={allTags}
            value={selectedTags}
            onChange={setSelectedTags}
            allowCreate
            placeholder="Add a tag (Enter)…"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Create'}
        </button>

        {!!msg && <p className="text-sm text-gray-700">{msg}</p>}
      </form>
    </section>
  )
}
