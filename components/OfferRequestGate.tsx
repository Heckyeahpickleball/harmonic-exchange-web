// components/OfferRequestGate.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';

type Props = {
  signedIn: boolean;
  isOwner: boolean;
  isOfferActive: boolean;
  /** Count of ACTIVE offers for the current viewer (0 means ineligible). */
  eligibleCount: number;
};

/**
 * Friendly banner that explains why the viewer can’t request yet,
 * and nudges them to create an offer. Shows ONLY when:
 * - signed in
 * - not the owner
 * - the offer is active
 * - viewer has 0 active offers (pending does NOT count)
 */
export default function OfferRequestGate({
  signedIn,
  isOwner,
  isOfferActive,
  eligibleCount,
}: Props) {
  const [dismissed, setDismissed] = useState(false);

  const show =
    signedIn && !isOwner && isOfferActive && (eligibleCount ?? 0) < 1 && !dismissed;

  if (!show) return null;

  return (
    <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      <div className="text-xl leading-none">💡</div>
      <div className="flex-1">
        <strong className="block">Why can’t I request?</strong>
        <p className="mt-1">
          To keep it gift-based and reciprocal, you need at least <b>one active offer</b> first.
          New offers start as <i>pending</i> and won’t count until approved.
        </p>
        <p className="mt-2">
          <Link href="/offers/new" className="underline">
            Create an offer
          </Link>{' '}
          and come back to request once it’s approved.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="ml-2 rounded px-2 py-1 text-xs underline"
        aria-label="Dismiss"
      >
        Dismiss
      </button>
    </div>
  );
}
