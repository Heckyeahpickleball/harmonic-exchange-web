// /components/OfferCard.tsx
'use client'

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
  return (
    <div className="rounded border p-4 bg-white shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{offer.title}</h3>
        <span className="text-xs px-2 py-1 rounded bg-gray-200">{offer.offer_type}</span>
      </div>
      <p className="text-sm text-gray-700 mt-1 line-clamp-3">{offer.description}</p>
      <div className="text-xs text-gray-600 mt-2">
        {offer.is_online ? 'Online' : [offer.city, offer.country].filter(Boolean).join(', ')}
      </div>
    </div>
  )
}
