// lib/withSuspense.tsx
import { Suspense, ReactNode } from 'react';

export function withSuspense<T extends object>(
  Comp: (props: T) => ReactNode,
  fallback: ReactNode = <div className="p-4 text-sm text-gray-600">Loading…</div>
) {
  return function Wrapped(props: T) {
    return <Suspense fallback={fallback}>{Comp(props)}</Suspense>;
  };
}
