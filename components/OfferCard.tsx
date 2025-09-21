// /components/OfferCard.tsx
'use client'

import Link from 'next/link'

export type Offer = {
  id: string
  title: string
  description: string | null
  offer_type: 'product' | 'service' | 'time' | 'knowledge' | 'other'
  is_online: boolean
  city: string | null
  country: string | null
  status: 'active' | 'paused' | 'archived' | 'blocked'
  created_at: string
}

export default function OfferCard({ offer }: { offer: Offer }) {
  const where = offer.is_online ? 'Online' : [offer.city, offer.country].filter(Boolean).join(', ')
  return (
    <div className="rounded border p-4 bg-white shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          <Link className="underline" href={`/offers/${offer.id}`}>{offer.title}</Link>
        </h3>
        <span className="text-xs px-2 py-1 rounded bg-gray-200">{offer.offer_type}</span>
      </div>
      <p className="text-sm text-gray-700 mt-1 line-clamp-3">{offer.description}</p>
      <div className="text-xs text-gray-600 mt-2">{where}</div>
      <div className="mt-3">
        <Link href={`/offers/${offer.id}`} className="rounded border px-3 py-2 text-sm">View & Request</Link>
      </div>
    </div>
  )
}
