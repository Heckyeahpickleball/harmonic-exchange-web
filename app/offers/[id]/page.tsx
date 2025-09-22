'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type Tag = { id: number; name: string }
type Offer = {
  id: string
  title: string
  description: string | null
  offer_type: string
  is_online: boolean
  city: string | null
  country: string | null
  status: string
  tags: Tag[]
}

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
      const { data, error } = await supabase
        .from('offers')
        .select('id,title,description,offer_type,is_online,city,country,status, offer_tags(tag_id, tags(name))')
        .eq('id', id)
        .single()

      if (error || !data) {
        setOffer(null)
        setMsg('Offer not found.')
      } else {
        const tags: Tag[] = (data.offer_tags ?? [])
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
          tags
        })
      }
      setLoading(false)
    })()
  }, [id])

  async function sendRequest(e: React.FormEvent) {
    e.preventDefault()
    setMsg('')
    try {
      if (!note.trim()) {
        setMsg('Please add a short note.')
        return
      }
      const { data, error } = await supabase.rpc('create_request', {
        p_offer: id,
        p_note: note.trim()
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

  const location = offer.is_online ? 'Online' : [offer.city, offer.country].filter(Boolean).join(', ')

  return (
    <section className="max-w-2xl space-y-3">
      <h2 className="text-2xl font-bold">{offer.title}</h2>
      <div className="text-sm text-gray-600">
        <span className="rounded bg-gray-100 px-2 py-[2px] text-[11px]">{offer.offer_type}</span>
        <span className="ml-2">{location}</span>
      </div>

      {offer.tags.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-2">
          {offer.tags.map(t => (
            <span key={t.id} className="rounded bg-gray-100 px-2 py-[2px] text-[11px]">#{t.name}</span>
          ))}
        </div>
      )}

      {offer.description && <p className="mt-2 whitespace-pre-wrap">{offer.description}</p>}

      <form onSubmit={sendRequest} className="mt-4 space-y-2">
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
