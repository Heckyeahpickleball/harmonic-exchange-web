// components/Badge.tsx
'use client';
import Image from 'next/image';
import Link from 'next/link';
import * as React from 'react';

export type BadgeProps = {
  icon: string;
  size?: number;
  title?: string;
  caption?: string;
  className?: string;
  href?: string;            // NEW
};

export default function Badge({
  icon,
  size = 44,
  title,
  caption,
  className = '',
  href,
}: BadgeProps) {
  const core = (
    <div
      className="rounded-full ring-2 ring-amber-300/80 shadow-sm overflow-hidden"
      title={title}
      style={{ width: size, height: size }}
      aria-label={title}
    >
      <Image
        src={icon}
        alt={title || caption || 'badge'}
        width={size}
        height={size}
        className="h-full w-full object-cover"
      />
    </div>
  );

  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      {href ? <Link href={href} aria-label={title || caption}>{core}</Link> : core}
      {caption ? (
        <div className="mt-1 text-[10px] leading-tight text-slate-600">{caption}</div>
      ) : null}
    </div>
  );
}
