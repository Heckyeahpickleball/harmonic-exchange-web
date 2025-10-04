'use client';

import * as React from 'react';

type Props = {
  /** image url to show inside the round badge */
  icon: string;
  /** px size of the circle */
  size?: number;
  /** tooltip/title text */
  title?: string;
  className?: string;
};

export default function Badge({ icon, size = 40, title, className = '' }: Props) {
  const s = Math.max(16, size);
  return (
    <div
      className={[
        'inline-flex items-center justify-center rounded-full border bg-white shadow-sm',
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
        style={{ width: Math.floor(s * 0.78), height: Math.floor(s * 0.78) }}
      />
    </div>
  );
}
