'use client';

import * as React from 'react';

/**
 * Render a circular badge image.
 * Safe to wrap in <Link> — it does not intercept clicks.
 */
export type BadgeProps = {
  icon: string;         // URL or /public path to the badge image
  size?: number;        // circle diameter in px
  title?: string;       // tooltip / aria-label
  className?: string;   // extra classes from parent
};

export default function Badge({
  icon,
  size = 40,
  title,
  className = '',
}: BadgeProps) {
  const dim = Math.max(16, size);

  return (
    <div
      role="img"
      aria-label={title}
      title={title}
      className={[
        'inline-flex items-center justify-center rounded-full',
        'border border-slate-200 bg-white shadow-sm overflow-hidden',
        'pointer-events-auto cursor-pointer select-none',
        className,
      ].join(' ')}
      style={{ width: dim, height: dim }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={icon}
        alt={title ?? 'Badge'}
        className="h-full w-full object-contain"
        draggable={false}
      />
    </div>
  );
}
