// app/some-route/page.tsx
import { Suspense } from 'react';
// If you did Option A (Bundler): use the next line
import Client from './page.client';
// If you did Option B (NodeNext/Node16): use this instead
// import Client from './page.client.js';

// Optional: keeps this page from being pre-rendered in ways that can
// surprise client hooks like useSearchParams
export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-600">Loading…</div>}>
      <Client />
    </Suspense>
  );
}
