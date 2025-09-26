/* HX v0.9 — Offer card (browse + “my offers”), owner controls restored
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
  /** Show owner controls (Edit / Pause / Archive / Set Active / Delete). Use in /offers/mine only. */
  mine?: boolean;
  /** Called after a successful delete so the parent list can remove the card. */
  onDeleted?: (id: string) => void;
  /** Optional: called after status change so parent can refetch if it wants. */
  onStatusChanged?: (id: string, next: OfferRow['status']) => void;
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

export function OfferCardImpl({ offer, mine = false, onDeleted, onStatusChanged }: Props) {
  // Keep a local copy so status changes reflect instantly.
  const [local, setLocal] = useState<OfferRow>(offer);
  const [busy, setBusy] = useState<'delete' | 'status' | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const thumb = Array.isArray(local.images) && local.images.length > 0 ? local.images[0] : null;
  const href = `/offers/${local.id}`;
  const location = local.is_online ? 'Online' : [local.city, local.country].filter(Boolean).join(', ');

  async function handleDelete() {
    setErr(null);
    if (!confirm('Delete this offer permanently? This cannot be undone.')) return;

    try {
      setBusy('delete');
      const { error } = await supabase.from('offers').delete().eq('id', local.id);
      if (error) throw error;
      onDeleted?.(local.id);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to delete');
    } finally {
      setBusy(null);
    }
  }

  async function setStatus(next: OfferRow['status']) {
    setErr(null);

    // Owners can set: active ↔ paused/archived. (Blocked is staff; Pending is review.)
    if (local.status === 'blocked' || local.status === 'pending') {
      setErr('This status can only be changed by staff.');
      return;
    }

    try {
      setBusy('status');
      // Optimistic update
      const prev = local.status;
      setLocal((s) => ({ ...s, status: next }));

      const { error } = await supabase.from('offers').update({ status: next }).eq('id', local.id);
      if (error) throw error;

      onStatusChanged?.(local.id, next);
    } catch (e: any) {
      // Revert if failed
      setLocal((s) => ({ ...s, status: offer.status }));
      setErr(e?.message ?? 'Failed to change status');
    } finally {
      setBusy(null);
    }
  }

  const canPause = mine && local.status === 'active';
  const canSetActive = mine && (local.status === 'paused' || local.status === 'archived');
  const canArchive = mine && local.status !== 'archived';
  const canEdit = mine; // always allow owner to open edit page
  const canDelete = mine; // always allow owner to delete

  return (
    <article className="rounded border">
      {/* Image (optional) */}
      <Link href={href} className="block">
        <div className="relative h-48 w-full overflow-hidden rounded-t bg-gray-100">
          {thumb ? (
            <Image
              src={thumb}
              alt={local.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-gray-400">No image</div>
          )}
        </div>
      </Link>

      <div className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Link href={href} className="block text-base font-semibold hover:underline">
              {local.title}
            </Link>
            <div className="mt-0.5 text-xs text-gray-600">
              {local.offer_type} • {location || '—'}
            </div>
          </div>
          <StatusBadge status={local.status} />
        </div>

        {/* Primary actions */}
        <div className="flex flex-wrap gap-2">
          <Link href={href} className="rounded border px-2 py-1 text-sm hover:bg-gray-50">
            {mine ? 'View' : 'View & Request'}
          </Link>

          {mine && (
            <>
              {canEdit && (
                <Link
                  href={`/offers/${local.id}/edit`}
                  className="rounded border px-2 py-1 text-sm hover:bg-gray-50"
                >
                  Edit
                </Link>
              )}

              {canPause && (
                <button
                  onClick={() => setStatus('paused')}
                  disabled={busy === 'status'}
                  className="rounded border px-2 py-1 text-sm hover:bg-gray-50 disabled:opacity-60"
                >
                  {busy === 'status' ? 'Working…' : 'Pause'}
                </button>
              )}

              {canArchive && local.status !== 'archived' && (
                <button
                  onClick={() => setStatus('archived')}
                  disabled={busy === 'status'}
                  className="rounded border px-2 py-1 text-sm hover:bg-gray-50 disabled:opacity-60"
                >
                  {busy === 'status' ? 'Working…' : 'Archive'}
                </button>
              )}

              {canSetActive && (
                <button
                  onClick={() => setStatus('active')}
                  disabled={busy === 'status'}
                  className="rounded border px-2 py-1 text-sm hover:bg-gray-50 disabled:opacity-60"
                >
                  {busy === 'status' ? 'Working…' : 'Set Active'}
                </button>
              )}

              {canDelete && (
                <button
                  onClick={handleDelete}
                  disabled={busy === 'delete'}
                  className="rounded border px-2 py-1 text-sm hover:bg-gray-50 disabled:opacity-60"
                  title="Delete permanently"
                >
                  {busy === 'delete' ? 'Deleting…' : 'Delete'}
                </button>
              )}
            </>
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
