import { Suspense } from 'react';
import WriteGratitudeClient from './write-client';

export const dynamic = 'force-dynamic'; // avoids static pre-render gotchas

export default function Page() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-600">Loading…</div>}>
      <WriteGratitudeClient />
    </Suspense>
  );
}
