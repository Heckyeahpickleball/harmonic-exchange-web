/* HX v0.7.1 — 2025-09-21 — OfferCard shows first image thumbnail
   File: components/OfferCard.tsx

   Notes:
   - Exports BOTH default and named `OfferCard` to satisfy different imports.
   - Tag id is `number | string` to tolerate varying Supabase shapes.
   - Handles null/empty `images`, lazy-loads <img>, basic a11y.
*/

import Link from 'next/link'

/** Minimal tag shape we display on cards. */
export type TagLite = {
  id: number | string
  name: string
}

export type OfferRow = {
  id: string
  title: string
  offer_type: string
  is_online: boolean
  city: string | null
  country: string | null
  images?: string[] | null
  tags?: TagLite[] | null
  /** sometimes present on list queries; safe to keep optional */
  created_at?: string
}

/** Richer type some detail pages use */
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
  images?: string[] | null
  tags?: TagLite[] | null
}

export type OfferCardProps = { offer: OfferRow }

function OfferCardImpl({ offer }: OfferCardProps) {
  const { id, title, offer_type, is_online, city, country, images, tags } = offer
  const thumb = images?.[0] ?? null
  const location = is_online ? 'Online' : [city, country].filter(Boolean).join(', ')

  return (
    <div className="overflow-hidden rounded border">
      {thumb ? (
        <Link href={`/offers/${id}`} aria-label={`Open ${title}`}>
          <img
            src={thumb}
            alt={title}
            loading="lazy"
            className="h-40 w-full object-cover"
          />
        </Link>
      ) : (
        <div className="flex h-40 w-full items-center justify-center bg-gray-50 text-xs text-gray-500">
          No image
        </div>
      )}

      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/offers/${id}`}
            className="min-w-0 font-semibold hover:underline"
            title={title}
          >
            <span className="line-clamp-1">{title}</span>
          </Link>
          <span className="shrink-0 rounded bg-gray-100 px-2 py-[2px] text-[11px]">
            {offer_type}
          </span>
        </div>

        <div className="mt-1 text-xs text-gray-600">{location || '—'}</div>

        {(tags?.length ?? 0) > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {tags!.map((t) => (
              <span
                key={String(t.id)}
                className="rounded bg-gray-100 px-2 py-[2px] text-[11px]"
              >
                {t.name}
              </span>
            ))}
          </div>
        )}

        <div className="mt-3">
          <Link
            href={`/offers/${id}`}
            className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
            aria-label={`View and request ${title}`}
          >
            View &amp; Request
          </Link>
        </div>
      </div>
    </div>
  )
}

/** Named export */
export const OfferCard = OfferCardImpl
/** Default export */
export default OfferCardImpl
