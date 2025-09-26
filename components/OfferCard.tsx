/* HX v0.8 — Offer card (browse + “my offers”), supports owner delete
   File: components/OfferCard.tsx
*/
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

/** Minimal shape used by lists (what your pages fetch). */
export type OfferRow = {
  id: string;
  title: string;
  offer_type: 'product' | 'service' | 'time' | 'knowledge' | 'other';
  is_online: boolean;
  city: string | null;
  country: string | null;
  status: 'pending' | 'active' | 'paused' | 'archived' | 'blocked';
  images?: string[] | null; // optional
};

type Props = {
  offer: OfferRow;
  /** Show owner controls (Delete). Use in /offers/mine only. */
  mine?: boolean;
  /** Called after a successful delete so the parent list can remove the card. */
  onDeleted?: (id: string) => void;
};

function StatusBadge({ status }: { status: OfferRow['status'] }) {
  if (status === 'active') return null;
  const label =
    status === 'pending'
      ? 'pending approval'
      : status === 'blocked'
      ? 'blocked'
      : status === 'paused'
      ? 'paused'
      : 'archived';
  return (
    <span className="rounded bg-gray-200 px-2 py-0.5 text-[11px] uppercase tracking-wide text-gray-700">
      {label}
    </span>
  );
}

export function OfferCardImpl({ offer, mine = false, onDeleted }: Props) {
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const thumb =
    Array.isArray(offer.images) && offer.images.length > 0 ? offer.images[0] : null;

  async function handleDelete() {
    setErr(null);
    if (!confirm('Delete this offer permanently? This cannot be undone.')) return;

    try {
      setDeleting(true);
      const { error } = await supabase.from('offers').delete().eq('id', offer.id);
      if (error) throw error;
      onDeleted?.(offer.id);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  }

  const href = `/offers/${offer.id}`;
  const location = offer.is_online
    ? 'Online'
    : [offer.city, offer.country].filter(Boolean).join(', ');

  return (
    <article className="rounded border">
      {/* Image (optional) */}
      <Link href={href} className="block">
        <div className="relative h-48 w-full overflow-hidden rounded-t bg-gray-100">
          {thumb ? (
            <Image
              src={thumb}
              alt={offer.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-gray-400">
              No image
            </div>
          )}
        </div>
      </Link>

      <div className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Link href={href} className="block text-base font-semibold hover:underline">
              {offer.title}
            </Link>
            <div className="mt-0.5 text-xs text-gray-600">
              {offer.offer_type} • {location || '—'}
            </div>
          </div>
          <StatusBadge status={offer.status} />
        </div>

        <div className="flex gap-2">
          <Link
            href={href}
            className="rounded border px-2 py-1 text-sm hover:bg-gray-50"
          >
            {mine ? 'View' : 'View & Request'}
          </Link>

          {mine && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded border px-2 py-1 text-sm hover:bg-gray-50 disabled:opacity-60"
              title="Delete permanently"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          )}
        </div>

        {err && <p className="text-xs text-red-600">{err}</p>}
      </div>
    </article>
  );
}

/** Named + default export so either import style works. */
export const OfferCard = OfferCardImpl;
export default OfferCardImpl;
