// /app/auth/pending/page.tsx
import { Suspense } from 'react';
import PendingClient from './PendingClient';

export const dynamic = 'force-dynamic'; // avoid static prerender issues with search params

export default function PendingPage() {
  return (
    <div className="mx-auto max-w-md p-6">
      <Suspense fallback={<p>Loading…</p>}>
        <PendingClient />
      </Suspense>
    </div>
  );
}
