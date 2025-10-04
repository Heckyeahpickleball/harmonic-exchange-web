// app/browse/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Shim page so legacy /browse continues to work.
 * Redirects client-side to /offers.
 */
export default function BrowseShim() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/offers');
  }, [router]);
  return <div className="text-sm text-gray-600">Loading…</div>;
}
