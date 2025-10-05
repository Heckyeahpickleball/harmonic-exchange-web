// /app/dev/badges/page.tsx
'use client';

import Badge from '@/components/Badge';
import Link from 'next/link';

export default function DevBadgesPage() {
  // Demo tiers just to visualize the component. Adjust or remove as needed.
  const tiers = [1, 2, 3, 4, 5];

  return (
    <section className="mx-auto max-w-3xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Badge Component Demo</h1>
        <Link href="/profile" className="text-sm underline">
          Back to Profile
        </Link>
      </div>

      <p className="text-sm text-slate-600">
        This page is only for local/manual testing of the <code>Badge</code> component.
      </p>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {tiers.map((tier) => (
          <div key={tier} className="flex flex-col items-center gap-2">
            {/* Use an icon that exists in /public/badges. Change these to your real files. */}
            <Badge
              icon={`/badges/give_t${tier}.png`}
              size={72}
              title={`Giver • Tier ${tier}`}
            />
            <div className="text-sm text-gray-600">Giver • Tier {tier}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
