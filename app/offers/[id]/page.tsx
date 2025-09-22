// /app/offers/[id]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import type { Offer } from '@/components/OfferCard'

export default function OfferDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [offer, setOffer] = useState<Offer | null>(null)
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('offers')
          .select('id,title,description,offer_type,is_online,city,country,status,created_at, offer_tags(tag_id, tags(name))')
          .eq('id', id)
          .single()
        if (error) throw error

        const tags = (data.offer_tags ?? [])
          .map((r: any) => ({ id: r?.tag_id, name: r?.tags?.name }))
          .filter((t: any) => t.id && t.name)

        setOffer({
          id: data.id,
          title: data.title,
          description: data.description,
          offer_type: data.offer_type,
          is_online: data.is_online,
          city: data.city,
          country: data.country,
          status: data.status,
          created_at: data.created_at,
          tags,
        })
      } catch (e) {
        console.error(e)
        setMsg('Offer not found.')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  async function requestOffer(e: React.FormEvent) {
    e.preventDefault()
    setMsg('')
    try {
      const { error } = await supabase.from('requests').insert({
        offer_id: id,
        requester_profile_id: (await supabase.auth.getUser()).data.user?.id,
        note,
        status: 'pending',
      })
      if (error) throw error
      setMsg('Request sent!')
      router.push('/inbox')
    } catch (err: any) {
      console.error(err)
      setMsg(err?.message ?? 'Could not send request.')
    }
  }

  if (loading) return <p>Loading…</p>
  if (!offer) return <p>{msg || 'Not found.'}</p>

  return (
    <section className="max-w-2xl space-y-3">
      <h2 className="text-2xl font-bold">{offer.title}</h2>
      <div className="text-sm text-gray-600">
        <span className="rounded bg-gray-100 px-2 py-[2px] text-[11px]">{offer.offer_type}</span>{' '}
        <span className="ml-2">{offer.is_online ? 'Online' : [offer.city, offer.country].filter(Boolean).join(', ')}</span>
      </div>

      {offer.tags?.length ? (
        <div className="mt-1 flex flex-wrap gap-2">
          {offer.tags.map(t => (
            <span key={t.id} className="rounded bg-gray-100 px-2 py-[2px] text-[11px]">
              #{t.name}
            </span>
          ))}
        </div>
      ) : null}

      {offer.description && <p className="mt-2 whitespace-pre-wrap">{offer.description}</p>}

      <form onSubmit={requestOffer} className="mt-4 space-y-2">
        <label className="block text-sm font-medium">Send a short note</label>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={4}
          className="w-full rounded border p-2"
          placeholder="Why are you requesting this?"
          required
        />
        <button className="rounded bg-black px-4 py-2 text-white">Request this Offer</button>
        {!!msg && <p className="text-sm text-gray-700">{msg}</p>}
      </form>
    </section>
  )
}
