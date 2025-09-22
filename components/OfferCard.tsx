// components/OfferCard.tsx
'use client'

import Link from 'next/link'

type OfferCardProps = {
  offer: {
    id: string
    title: string
    offer_type: string
    is_online: boolean
    city: string | null
    country: string | null
    tags?: string[]
  }
}

export default function OfferCard({ offer }: OfferCardProps) {
  const loc = offer.is_online ? 'Online' : [offer.city, offer.country].filter(Boolean).join(', ')
  return (
    <div className="rounded border p-4">
      <Link href={`/offers/${offer.id}`} className="block">
        <h3 className="text-lg font-semibold underline">{offer.title}</h3>
      </Link>
      <div className="mt-1 text-sm text-gray-600">
        <span className="rounded border px-2 py-0.5 text-xs">{offer.offer_type}</span>
      </div>
      <div className="mt-1 text-sm">{loc}</div>

      {!!offer.tags?.length && (
        <div className="mt-2 flex flex-wrap gap-2">
          {offer.tags.map(t => (
            <span key={t} className="rounded-full border px-2 py-0.5 text-xs">#{t}</span>
          ))}
        </div>
      )}

      <div className="mt-3">
        <Link href={`/offers/${offer.id}`} className="rounded border px-3 py-1 text-sm">
          View &amp; Request
        </Link>
      </div>
    </div>
  )
}
