'use client';

import Image from 'next/image';
import * as React from 'react';

export type BadgeProps = {
  /** Path under /public, e.g. "/badges/give_t1.png" (or any absolute URL) */
  icon: string;
  /** Pixel size for the circular icon (both width & height) */
  size?: number;
  /** Tooltip text for hover (optional) */
  title?: string;
  /** Visible caption rendered underneath (optional) */
  caption?: string;
  /** Extra classes on the wrapper */
  className?: string;
};

export default function Badge({
  icon,
  size = 40,
  title,
  caption,
  className = '',
}: BadgeProps) {
  return (
    <div className={['inline-flex flex-col items-center', className].join(' ')}>
      <div
        className="relative overflow-hidden rounded-full ring-1 ring-black/5 shadow-sm bg-white"
        style={{ width: size, height: size }}
        title={title}
        aria-label={title}
      >
        {/* If you ever serve remote icons, you can swap to plain <img> */}
        <Image
          src={icon}
          alt={title ?? 'Badge'}
          width={size}
          height={size}
          className="h-full w-full object-cover"
        />
      </div>

      {caption ? (
        <div className="mt-1 text-[10px] leading-tight text-slate-600 text-center max-w-[84px]">
          {caption}
        </div>
      ) : null}
    </div>
  );
}
