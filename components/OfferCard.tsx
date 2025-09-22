import Link from 'next/link'

export type OfferRow = {
  id: string
  title: string
  offer_type: string
  is_online: boolean
  city: string | null
  country: string | null
  tags?: { id: number; name: string }[]
}

// Richer type used by the detail / “mine” pages
export type Offer = {
  id: string
  title: string
  description?: string | null
  offer_type: string
  is_online: boolean
  city: string | null
  country: string | null
  status: string
  created_at: string
  tags?: { id: number; name: string }[]
}

export default function OfferCard({ offer }: { offer: OfferRow }) {
  const { id, title, offer_type, is_online, city, country, tags = [] } = offer
  return (
    <div className="rounded border p-3">
      <div className="flex items-start justify-between">
        <Link href={`/offers/${id}`} className="font-semibold hover:underline">
          {title}
        </Link>
        <span className="rounded bg-gray-100 px-2 py-[2px] text-[11px]">{offer_type}</span>
      </div>

      <div className="mt-1 text-xs text-gray-600">
        {is_online ? 'Online' : [city, country].filter(Boolean).join(', ')}
      </div>

      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.map(t => (
            <span key={t.id} className="rounded bg-gray-100 px-2 py-[2px] text-[11px]">
              {t.name}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3">
        <Link href={`/offers/${id}`} className="rounded border px-3 py-1 text-sm hover:bg-gray-50">
          View & Request
        </Link>
      </div>
    </div>
  )
}
