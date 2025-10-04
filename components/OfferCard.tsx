// components/OfferCard.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export type OfferRow = {
  id: string;
  title: string;
  offer_type: 'product' | 'service' | 'time' | 'knowledge' | 'other';
  is_online: boolean;
  city: string | null;
  country: string | null;
  status: 'pending' | 'active' | 'paused' | 'archived' | 'blocked';
  images?: string[] | null;
  owner_name?: string;
  owner_id?: string;
};

type Props = {
  offer: OfferRow;
  mine?: boolean;
  onDeleted?: (id: string) => void;
};

function StatusBadge({ status }: { status: OfferRow['status'] }) {
  if (status === 'active') return null;
  const label =
    status === 'pending'
      ? 'PENDING'
      : status === 'blocked'
      ? 'BLOCKED'
      : status === 'paused'
      ? 'PAUSED'
      : 'ARCHIVED';
  return (
    <span className="rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide text-gray-700">
      {label}
    </span>
  );
}

function isLikelyValidUrl(u?: string | null) {
  if (!u || typeof u !== 'string') return false;
  try {
    if (u.startsWith('data:')) return true;
    const url = new URL(u);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    // allow app/public relative paths
    return u.startsWith('/') || u.startsWith('./');
  }
}

export default function OfferCard({ offer, mine = false, onDeleted }: Props) {
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const thumbRaw =
    Array.isArray(offer.images) && offer.images.length > 0 ? offer.images[0] : null;

  const thumb = useMemo<string>(() => {
    if (thumbRaw && isLikelyValidUrl(thumbRaw)) return thumbRaw as string;
    // Use existing favicon as a guaranteed local fallback
    return '/favicon.ico';
  }, [thumbRaw]);

  async function handleDelete() {
    setErr(null);
    if (!confirm('Delete this offering permanently? This cannot be undone.')) return;
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
  const location = offer.is_online ? 'Online' : [offer.city, offer.country].filter(Boolean).join(', ');

  return (
    <article className="hx-card transition hover:shadow-md">
      <Link href={href} className="block" prefetch={false}>
        <div className="relative h-48 w-full overflow-hidden rounded-t bg-gray-100">
          <Image
            src={thumb}
            alt={offer.title || 'Offer image'}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
            unoptimized
            onError={(e) => {
              const el = e.target as HTMLImageElement | null;
              if (el && el.getAttribute('src') !== '/favicon.ico') {
                el.setAttribute('src', '/favicon.ico');
              }
            }}
            draggable={false}
          />
        </div>
      </Link>

      <div className="space-y-3 p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Link href={href} className="block text-base font-semibold hover:underline" prefetch={false}>
              {offer.title}
            </Link>
            <div className="mt-0.5 text-xs text-gray-600">
              {offer.offer_type} • {location || '—'}
            </div>
            {offer.owner_name && offer.owner_id && (
              <div className="mt-0.5 text-xs text-gray-500">
                by{' '}
                <Link href={`/u/${offer.owner_id}`} className="hx-link" prefetch={false}>
                  {offer.owner_name}
                </Link>
              </div>
            )}
          </div>
          <StatusBadge status={offer.status} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href={href} className="hx-btn hx-btn--outline-primary text-sm" prefetch={false}>
            View
          </Link>

          {!mine && (
            <Link href={href} className="hx-btn hx-btn--primary text-sm" prefetch={false}>
              Ask to Receive
            </Link>
          )}

          {mine && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="hx-btn hx-btn--secondary text-sm disabled:opacity-60"
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
