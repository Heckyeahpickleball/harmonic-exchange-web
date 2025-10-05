'use client';

import * as React from 'react';
import Badge from '@/components/Badge';

const TIERS = [1, 2, 3, 4, 5];

export default function DevBadgesPage() {
  return (
    <section className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Badge Dev</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {TIERS.map((tier) => {
          const code = `give_t${tier}`;
          const icon = `/badges/${code}.png`; // falls back to 404 if you don't have the file
          const title = `Giver • Tier ${tier}`;

          return (
            <div key={`t-${tier}`} className="flex flex-col items-center gap-2">
              <Badge icon={icon} size={72} title={title} />
              <div className="text-sm text-gray-500">{title}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
