'use client';

import * as React from 'react';

type Props = {
  icon: string;
  size?: number;       // logical size in px (desktop)
  title?: string;
  className?: string;
};

export default function Badge({ icon, size = 40, title, className = '' }: Props) {
  // Never render smaller than 16px; scale down slightly on tiny screens without affecting desktop.
  const base = Math.max(16, size);
  const s = typeof window !== 'undefined' && window.innerWidth <= 640 ? Math.round(base * 0.9) : base;

  return (
    <div
      className={[
        'inline-flex items-center justify-center rounded-full bg-white shadow-sm',
        className,
      ].join(' ')}
      style={{ width: s, height: s }}
      title={title}
      aria-label={title}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={icon}
        alt={title || 'Badge'}
        width={Math.floor(s * 1.78)}
        height={Math.floor(s * 1)}
        loading="lazy"
        decoding="async"
        style={{ width: Math.floor(s * 1.78), height: Math.floor(s * 1) }}
      />
    </div>
  );
}
