import { Suspense } from 'react';
import ClientBadges from './ClientBadges';

// Force runtime rendering (valid only on the server page)
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const dynamicParams = true;

export default function Page() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-600">Loading badges…</div>}>
      <ClientBadges />
    </Suspense>
  );
}
