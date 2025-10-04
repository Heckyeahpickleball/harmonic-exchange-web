'use client';
import { useState } from 'react';

export default function HydrationDebug() {
  const [n, setN] = useState(0);
  return (
    <section className="p-6 space-y-3">
      <h1 className="text-xl font-bold">Hydration Debug</h1>
      <button
        className="rounded border px-3 py-2"
        onClick={() => setN((x) => x + 1)}
      >
        Clicks: {n}
      </button>
      <p className="text-sm text-gray-600">
        If this button increments, React is hydrating on this page.
      </p>
    </section>
  );
}
