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

/**
 * Small circular badge icon.
 * - Keeps same public API as before (icon/size/title/className)
 * - Adds sensible fallbacks and a11y niceties
 */
export default function Badge({ icon, size = 40, title, className = '' }: Props) {
  const s = Math.max(16, Math.round(size));
  const inner = Math.floor(s * 0.78);

  // Fallback icon in case the provided path 404s
  const [src, setSrc] = React.useState(icon || '/badges/placeholder.png');
  React.useEffect(() => setSrc(icon || '/badges/placeholder.png'), [icon]);

  return (
    <div
      className={[
        'inline-flex items-center justify-center rounded-full border bg-white shadow-sm select-none',
        className,
      ].join(' ')}
      style={{ width: s, height: s }}
      title={title}
      aria-label={title}
      role="img"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={title || 'Badge'}
        width={inner}
        height={inner}
        style={{ width: inner, height: inner }}
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={() => {
          if (src !== '/badges/placeholder.png') setSrc('/badges/placeholder.png');
        }}
      />
    </div>
  );
}
