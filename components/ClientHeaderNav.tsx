// components/ClientHeaderNav.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import NotificationsBell from '@/components/NotificationsBell';

/** Simple inline SVG icons so we don't add deps */
function Icon({ name, className = 'h-6 w-6' }: { name: 'home'|'globe'|'swap'|'map'|'user'; className?: string }) {
  switch (name) {
    case 'home':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
          <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M3 11.5 12 4l9 7.5v7a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 18.5v-7z" />
          <path strokeWidth="1.8" strokeLinecap="round" d="M9 21V12h6v9" />
        </svg>
      );
    case 'globe':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
          <circle cx="12" cy="12" r="9" strokeWidth="1.8" />
          <path strokeWidth="1.8" d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />
        </svg>
      );
    case 'swap':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
          <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M7 7h10M7 7l2-2m-2 2 2 2M17 17H7m10 0-2 2m2-2-2-2" />
        </svg>
      );
    case 'map':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
          <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M9.5 21 3 18V4l6.5 3L15 4l6 3v14l-6-3-5.5 3z" />
        </svg>
      );
    case 'user':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
          <circle cx="12" cy="8" r="4" strokeWidth="1.8" />
          <path strokeWidth="1.8" strokeLinecap="round" d="M4 20c1.7-3.2 5-5 8-5s6.3 1.8 8 5" />
        </svg>
      );
  }
}

function NavIcon({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: React.ReactElement;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        'flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-xl',
        active ? 'text-[var(--hx-brand)]' : 'text-gray-700',
        'hover:bg-gray-100 active:bg-gray-200',
        'tap-big',
      ].join(' ')}
      title={label}
      aria-label={label}
    >
      {icon}
      <span className="text-[10px] leading-none">{label}</span>
    </Link>
  );
}

export default function ClientHeaderNav() {
  const pathname = usePathname() || '/';

  // Map routes to active states (tweak to match your paths)
  const is = (p: string) => pathname === p || pathname.startsWith(p + '/');

  return (
    <header className="w-full border-b bg-white">
      {/* Desktop / tablet: keep your existing button layout */}
      <div className="hidden md:flex items-center gap-2 px-4 py-3 max-w-6xl mx-auto">
        <Link href="/" className="hx-btn hx-btn--chip">Home</Link>
        <Link href="/offers" className={`hx-btn hx-btn--chip ${is('/offers') ? 'ring-1 ring-[var(--hx-brand)]' : ''}`}>Global Exchange</Link>
        <Link href="/exchange" className={`hx-btn hx-btn--chip ${is('/exchange') ? 'ring-1 ring-[var(--hx-brand)]' : ''}`}>Exchange</Link>
        <Link href="/chapters" className={`hx-btn hx-btn--chip ${is('/chapters') ? 'ring-1 ring-[var(--hx-brand)]' : ''}`}>Local Chapters</Link>
        <Link href="/profile" className={`hx-btn hx-btn--chip ${is('/profile') ? 'ring-1 ring-[var(--hx-brand)]' : ''}`}>Profile</Link>

        <div className="ml-auto flex items-center gap-3">
          {/* Notifications bell stays the same */}
          <NotificationsBell />
          <Link href="/sign-in" className="hx-btn hx-btn--outline-primary">Sign in</Link>
        </div>
      </div>

      {/* Mobile: compact top bar + icon rail */}
      <div className="md:hidden px-3 pt-2 pb-1">
        {/* Top row: right-aligned Sign in, bell to its left */}
        <div className="flex items-center justify-end gap-2">
          <NotificationsBell />
          <Link
            href="/sign-in"
            className="inline-flex items-center rounded-full border border-[var(--hx-brand)] text-[var(--hx-brand)] px-3 py-1.5 text-sm font-medium hover:bg-emerald-50"
          >
            Sign in
          </Link>
        </div>

        {/* Icon rail */}
        <nav
          className="mt-2 flex items-center justify-between gap-1 rounded-xl border bg-white px-2 py-1.5"
          aria-label="Primary"
        >
          <NavIcon href="/" icon={<Icon name="home" />} label="Home" active={is('/')} />
          <NavIcon href="/offers" icon={<Icon name="globe" />} label="Global" active={is('/offers')} />
          <NavIcon href="/exchange" icon={<Icon name="swap" />} label="Exchange" active={is('/exchange')} />
          <NavIcon href="/chapters" icon={<Icon name="map" />} label="Chapters" active={is('/chapters')} />
          <NavIcon href="/profile" icon={<Icon name="user" />} label="Profile" active={is('/profile')} />
        </nav>
      </div>
    </header>
  );
}
