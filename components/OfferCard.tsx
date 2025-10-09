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
  showAskCTA = false, // default off so Browse grid doesn't show Ask
  isAdmin = false,
  onDeleted,
  onApproved,
}: Props) {
  const [deleting, setDeleting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
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

      setStatus('active');
      onApproved?.(offer.id);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to approve');
    } finally {
      setApproving(false);
    }
  }

  const href = `/offers/${offer.id}`;
  const location = offer.is_online ? 'Online' : [offer.city, offer.country].filter(Boolean).join(', ');

  // Build the lower action list (excludes "View", which moved to header)
  const bottomActions: React.ReactElement[] = [];

  if (showAskCTA && !mine) {
    bottomActions.push(
      <Link key="ask" href={href} className="hx-btn hx-btn--primary text-sm">
        Ask to Receive
      </Link>
    );
  }

  if (offer.owner_id) {
    bottomActions.push(
      <Link
        key="provider"
        href={`/u/${offer.owner_id}`}
        className="hx-btn hx-btn--outline-secondary text-sm"
        title="View provider profile"
      >
        View Provider
      </Link>
    );
  }

  if (mine) {
    bottomActions.push(
      <Link
        key="edit"
        href={`/offers/${offer.id}/edit`}
        className="hx-btn hx-btn--primary text-sm"
        title="Edit this offer"
      >
        Edit
      </Link>
    );
    bottomActions.push(
      <button
        key="delete"
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="hx-btn hx-btn--secondary text-sm disabled:opacity-60"
        title="Delete permanently"
      >
        {deleting ? 'Deleting…' : 'Delete'}
      </button>
    );
  }

  if (isAdmin && status === 'pending') {
    bottomActions.push(
      <button
        key="approve"
        type="button"
        onClick={handleApprove}
        disabled={approving}
        className="hx-btn hx-btn--success text-sm disabled:opacity-60"
        title="Approve this offer"
      >
        {approving ? 'Approving…' : 'Approve'}
      </button>
    );
  }

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
            <div className="flex h-full items-center justify-center text-xs text-gray-400">No image</div>
          )}
        </div>
      </Link>

      <div className="space-y-3 p-3">
        {/* Header row: title/description on left, View + status on right */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={href} className="block truncate text-base font-semibold hover:underline">
              {offer.title}
            </Link>
            <div className="mt-0.5 text-xs text-gray-600 truncate">
              {offer.offer_type} • {location || '—'}
            </div>
            {offer.owner_name && offer.owner_id && (
              <div className="mt-0.5 text-xs text-gray-500 truncate">
                by{' '}
                <Link href={`/u/${offer.owner_id}`} className="hx-link">
                  {offer.owner_name}
                </Link>
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2">
            <StatusBadge status={status} />
            <Link href={href} className="hx-btn hx-btn--outline-primary text-sm">
              View
            </Link>
          </div>
        </div>

        {/* Bottom actions (hidden when empty for a tighter card) */}
        {bottomActions.length > 0 && <div className="flex flex-wrap gap-2">{bottomActions}</div>}

        {err && <p className="text-xs text-red-600">{err}</p>}
      </div>
    </article>
  );
}
