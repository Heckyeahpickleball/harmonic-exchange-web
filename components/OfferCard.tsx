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
  /** True if the offer belongs to the viewing user (e.g., on Profile -> My offers) */
  mine?: boolean;
  /** Only show the Ask-to-Receive CTA when explicitly enabled. Default: false */
  showAskCTA?: boolean;
  /** If the viewing user is an admin/moderator, pass true to expose approval actions */
  isAdmin?: boolean;
  /** Called after a successful delete */
  onDeleted?: (id: string) => void;
  /** Called after a successful approve (status -> active) */
  onApproved?: (id: string) => void;
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

export default function OfferCard({
  offer,
  mine = false,
  showAskCTA = false, // ← default off so browse grids won't show Ask
  isAdmin = false,
  onDeleted,
  onApproved,
}: Props) {
  const [deleting, setDeleting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Keep a local status so the card reflects changes immediately
  const [status, setStatus] = useState<OfferRow['status']>(offer.status);

  const thumb = useMemo(
    () => (Array.isArray(offer.images) && offer.images.length > 0 ? offer.images[0] : null),
    [offer.images]
  );

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

  async function handleApprove() {
    // Try secured RPC first; fallback to direct update if RPC is missing.
    setErr(null);
    try {
      setApproving(true);

      const rpc = await supabase.rpc('admin_offer_set_status', {
        p_offer_id: offer.id,
        p_status: 'active',
        p_reason: null,
      });

      if (rpc.error) {
        const msg = rpc.error.message || '';
        const fnMissing = /function .*admin_offer_set_status.* does not exist/i.test(msg);

        if (!fnMissing) throw rpc.error;

        // Fallback: direct update (requires correct RLS for admin/mod)
        const { error: upErr } = await supabase
          .from('offers')
          .update({ status: 'active' })
          .eq('id', offer.id);

        if (upErr) {
          if (/permission denied|row-level security/i.test(upErr.message)) {
            throw new Error(
              "RLS blocked this update. Your admin/mod policy for the 'offers' table may be missing."
            );
          }
          throw upErr;
        }

        // Best-effort admin action log (non-blocking)
        try {
          const { data: auth } = await supabase.auth.getUser();
          await supabase.from('admin_actions').insert({
            admin_profile_id: auth.user?.id ?? null,
            action: 'offers.status -> active',
            target_type: 'offer',
            target_id: offer.id,
            reason: null,
          });
        } catch {}
      }

      setStatus('active');      // optimistic UI
      onApproved?.(offer.id);   // let parent refresh if needed
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to approve');
    } finally {
      setApproving(false);
    }
  }

  const href = `/offers/${offer.id}`;
  const location = offer.is_online ? 'Online' : [offer.city, offer.country].filter(Boolean).join(', ');

  return (
    <article className="hx-card transition hover:shadow-md">
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

      <div className="space-y-3 p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Link href={href} className="block text-base font-semibold hover:underline">
              {offer.title}
            </Link>
            <div className="mt-0.5 text-xs text-gray-600">
              {offer.offer_type} • {location || '—'}
            </div>
            {offer.owner_name && offer.owner_id && (
              <div className="mt-0.5 text-xs text-gray-500">
                by{' '}
                <Link href={`/u/${offer.owner_id}`} className="hx-link">
                  {offer.owner_name}
                </Link>
              </div>
            )}
          </div>
          <StatusBadge status={status} />
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Link href={href} className="hx-btn hx-btn--outline-primary text-sm">
            View
          </Link>

          {/* Ask CTA only if explicitly allowed AND not mine */}
          {showAskCTA && !mine && (
            <Link href={href} className="hx-btn hx-btn--primary text-sm">
              Ask to Receive
            </Link>
          )}

          {/* View Provider */}
          {offer.owner_id && (
            <Link
              href={`/u/${offer.owner_id}`}
              className="hx-btn hx-btn--outline-secondary text-sm"
              title="View provider profile"
            >
              View Provider
            </Link>
          )}

          {/* Owner: Edit + Delete */}
          {mine && (
            <>
              <Link
                href={`/offers/${offer.id}/edit`}
                className="hx-btn hx-btn--primary text-sm"
                title="Edit this offer"
              >
                Edit
              </Link>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="hx-btn hx-btn--secondary text-sm disabled:opacity-60"
                title="Delete permanently"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </>
          )}

          {/* Admin: Approve pending */}
          {isAdmin && status === 'pending' && (
            <button
              type="button"
              onClick={handleApprove}
              disabled={approving}
              className="hx-btn hx-btn--success text-sm disabled:opacity-60"
              title="Approve this offer"
            >
              {approving ? 'Approving…' : 'Approve'}
            </button>
          )}
        </div>

        {err && <p className="text-xs text-red-600">{err}</p>}
      </div>
    </article>
  );
}
