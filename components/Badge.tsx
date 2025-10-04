'use client';

import Image from 'next/image';
import * as React from 'react';

export type BadgeProps = {
  /** Path under /public, e.g. "/badges/give_rays_t1.png" */
  icon: string;
  /** Pixel size of the circular icon (both width & height) */
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
  size = 44,
  title,
  caption,
  className = '',
}: BadgeProps) {
  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <div
        className="rounded-full ring-2 ring-amber-300/80 shadow-sm overflow-hidden"
        title={title}
        style={{ width: size, height: size }}
        aria-label={title}
      >
        {/* Using next/image for perf + consistent sizing */}
        <Image
          src={icon}
          alt={title || caption || 'badge'}
          width={size}
          height={size}
          className="h-full w-full object-cover"
        />
      </div>

      {caption ? (
        <div className="mt-1 text-[10px] leading-tight text-slate-600">
          {caption}
        </div>
      ) : null}
    </div>
  );
}
