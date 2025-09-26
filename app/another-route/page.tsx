import { Suspense } from 'react';
import Client from './page.client';

export const dynamic = 'force-dynamic'; // optional, avoids stray prerendering

export default function Page() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-600">Loading…</div>}>
      <Client />
    </Suspense>
  );
}
