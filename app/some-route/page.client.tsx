'use client';

import { useSearchParams } from 'next/navigation';
import ClientOnly from '@/components/ClientOnly';

export default function Client() {
  const params = useSearchParams();
  const foo = params.get('foo') ?? '—';

  return (
    <ClientOnly>
      <div className="p-4 text-sm">
        <div className="text-gray-600">This is client-only content.</div>
        <div className="mt-1">
          Example param <code>foo</code>: <strong>{foo}</strong>
        </div>
      </div>
    </ClientOnly>
  );
}
