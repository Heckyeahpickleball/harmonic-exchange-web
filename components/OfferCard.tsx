'use client'

import Link from 'next/link'

export type OfferCardProps = {
  id: string
  title: string
  offer_type: 'product' | 'service' | 'time' | 'knowledge' | 'other'
  is_online: boolean
  city: string | null
  country: string | null
  status?: 'active' | 'paused' | 'archived' | 'blocked'
  /**
   * Optional list of tag names to render as small chips.
   */
  tags?: string[]
}

/**
 * Small card used on Browse / My Offers lists.
 */
export default function OfferCard({
  id,
  title,
  offer_type,
  is_online,
  city,
  country,
  status = 'active',
  tags = [],
}: OfferCardProps) {
  const location =
    is_online ? 'Online' : [city, country].filter(Boolean).join(', ') || '—'

  const statusBadge =
    status !== 'active' ? (
      <span className="ml-2 rounded bg-gray-200 px-2 py-0.5 text-[10px] uppercase leading-none">
        {status}
      </span>
    ) : null

  return (
    <div className="rounded border p-4">
      <div className="flex items-start justify-between">
        <h3 className="text-lg font-semibold">
          <Link href={`/offers/${id}`} className="hover:underline">
            {title}
          </Link>
        </h3>
        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs">
          {offer_type}
        </span>
      </div>

      <div className="mt-1 text-xs text-gray-600">{location}{statusBadge}</div>

      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.map((t) => (
            <span
              key={t}
              className="rounded border px-2 py-0.5 text-[11px] leading-none"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3">
        <Link
          href={`/offers/${id}`}
          className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
        >
          View & Request
        </Link>
      </div>
    </div>
  )
}
