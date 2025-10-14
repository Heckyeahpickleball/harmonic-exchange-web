'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function Page() {
  return (
    <Suspense fallback={<section className="p-6 text-sm text-gray-600">Loading…</section>}>
      <WriteGratitudePageInner />
    </Suspense>
  );
}

function WriteGratitudePageInner() {
  const sp = useSearchParams();
  const requestId = sp.get('request_id');
  const offerId = sp.get('offer_id') || null;

  if (!requestId) {
    return (
      <section className="p-6">
        <h1 className="text-xl font-semibold mb-2">Write Gratitude</h1>
        <p className="text-sm text-gray-600">
          Missing <code>request_id</code>.
        </p>
        <p className="mt-4">
          <Link href="/exchange" className="underline">
            Go back to exchanges
          </Link>
        </p>
      </section>
    );
  }

  // TODO: if you have a real composer, render it here instead of the placeholder.
  // e.g. <GratitudeComposer requestId={requestId} offerId={offerId} />
  return (
    <section className="p-6">
      <h1 className="text-xl font-semibold mb-3">Say Thanks</h1>
      <p className="text-sm mb-4">
        You’re writing a gratitude note for request <code>{requestId}</code>
        {offerId ? (
          <>
            {' '}
            (offer <code>{offerId}</code>)
          </>
        ) : null}
        .
      </p>
      <p className="text-sm text-gray-600">Drop in your existing Gratitude component here when ready.</p>
      <p className="mt-4">
        <Link href="/exchange" className="underline">
          Back to Past Exchanges
        </Link>
      </p>
    </section>
  );
}
