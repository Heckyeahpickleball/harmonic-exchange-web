// components/ClientHeaderNav.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import NotificationsBell from '@/components/NotificationsBell';
import MessagesUnreadBadge from '@/components/MessagesUnreadBadge';

type Role = 'user' | 'moderator' | 'admin';

/** Minimal inline icons */
function Icon({
  name,
  className = 'h-6 w-6',
}: {
  name: 'home' | 'globe' | 'swap' | 'map' | 'user';
  className?: string;
}) {
  switch (name) {
    case 'home':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
          <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M3 11.5 12 4l9 7.5v7A1.5 1.5 0 0 1 19.5 20h-15A1.5 1.5 0 0 1 3 18.5v-7z" />
          <path strokeWidth="1.8" strokeLinecap="round" d="M9 20v-8h6v8" />
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
  const router = useRouter();
  const pathname = usePathname() || '/';
  const [uid, setUid] = useState<string | null>(null);
  const [role, setRole] = useState<Role>('user');
  const [busy, setBusy] = useState(false);
  const signedIn = !!uid;

  // desktop dropdowns
  const [openExchange, setOpenExchange] = useState(false);
  const [openChapters, setOpenChapters] = useState(false);
  const [openProfile, setOpenProfile] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data?.user?.id ?? null;
      setUid(u);
      if (u) {
        const { data: p } = await supabase.from('profiles').select('role').eq('id', u).single();
        if (p?.role) setRole(p.role as Role);
      }
    })();
  }, []);

  async function signOut() {
    try {
      setBusy(true);
      await supabase.auth.signOut();
      window.location.href = '/';
    } finally {
      setBusy(false);
    }
  }

  const showAdmin = role === 'admin' || role === 'moderator';
  const is = (p: string) => pathname === p || pathname.startsWith(p + '/');

  // treat offers/exchange/browse as the same “Exchange” bucket for active state
  const isExchangeBucket = is('/offers') || is('/exchange') || is('/browse');

  return (
    <header className="w-full border-b bg-white">
      {/* ===== Desktop / tablet ===== */}
      <nav className="hidden md:flex items-center justify-between gap-3 py-2 max-w-6xl mx-auto px-4">
        {/* LEFT: brand + primary links */}
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/" className="underline-offset-4 hover:underline">Home</Link>

          {/* Global now gated when logged out */}
          <Link
            href={signedIn ? '/global' : '/sign-in'}
            className="hx-btn hx-btn--secondary text-sm px-3 py-2"
          >
            Global Exchange
          </Link>

          <div className="relative">
            <button
              className="hx-btn hx-btn--secondary text-sm px-3 py-2"
              onClick={() => {
                // Exchange dropdown is fine to open for everyone
                setOpenExchange(v => !v);
                setOpenChapters(false);
                setOpenProfile(false);
              }}
              aria-haspopup="menu"
              aria-expanded={openExchange}
            >
              Exchange
            </button>
            {openExchange && (
              <div className="absolute z-50 mt-2 w-56 hx-card p-2" role="menu" onMouseLeave={() => setOpenExchange(false)}>
                {/* Browse & New Offer in dropdown */}
                <Link href="/offers" className="block rounded px-3 py-2 hover:bg-gray-50" role="menuitem">
                  Browse Offers
                </Link>
                <Link
                  href={signedIn ? '/offers/new' : '/sign-in'}
                  className="block rounded px-3 py-2 hover:bg-gray-50"
                  role="menuitem"
                >
                  New Offer
                </Link>
                <Link href="/exchanges" className="block rounded px-3 py-2 hover:bg-gray-50" role="menuitem">
                  My Exchanges
                </Link>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              className="hx-btn hx-btn--secondary text-sm px-3 py-2"
              onClick={() => {
                if (!signedIn) {
                  router.push('/sign-in');
                  return;
                }
                setOpenChapters(v => !v);
                setOpenExchange(false);
                setOpenProfile(false);
              }}
              aria-haspopup="menu"
              aria-expanded={openChapters}
            >
              Local Chapters
            </button>
            {openChapters && signedIn && (
              <div className="absolute z-50 mt-2 w-60 hx-card p-2" role="menu" onMouseLeave={() => setOpenChapters(false)}>
                <Link href="/chapters" className="block rounded px-3 py-2 hover:bg-gray-50" role="menuitem">
                  Explore Chapters
                </Link>
                <Link href="/chapters/start" className="block rounded px-3 py-2 hover:bg-gray-50" role="menuitem">
                  Start a Chapter
                </Link>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              className="hx-btn hx-btn--secondary text-sm px-3 py-2"
              onClick={() => {
                if (!signedIn) {
                  router.push('/sign-in');
                  return;
                }
                setOpenProfile(v => !v);
                setOpenExchange(false);
                setOpenChapters(false);
              }}
              aria-haspopup="menu"
              aria-expanded={openProfile}
            >
              Profile
            </button>
            {openProfile && signedIn && (
              <div className="absolute z-50 mt-2 w-56 hx-card p-2" role="menu" onMouseLeave={() => setOpenProfile(false)}>
                <Link href="/profile" className="block rounded px-3 py-2 hover:bg-gray-50" role="menuitem">
                  My Profile
                </Link>
                <Link
                  href={signedIn ? '/messages' : '/sign-in'}
                  className="block rounded px-3 py-2 hover:bg-gray-50"
                  role="menuitem"
                >
                  Messages <span className="ml-1 align-middle"><MessagesUnreadBadge /></span>
                </Link>
              </div>
            )}
          </div>

          {showAdmin && (
            <Link href="/admin" className="underline-offset-4 hover:underline">Admin</Link>
          )}
        </div>

        {/* RIGHT: Facebook -> bell -> auth */}
        <div className="flex items-center gap-2">
          {/* Facebook group button (borderless icon) */}
          <Link
            href="https://www.facebook.com/groups/harmonicexchangeglobal"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Harmonic Exchange Facebook Group"
            title="Harmonic Exchange Facebook Group"
            className="inline-flex items-center focus:outline-none hover:opacity-90 active:opacity-80"
          >
            <Image
              src="/Facebook-Round-Icon.jpg"
              alt="Facebook"
              width={40}
              height={40}
              className="block"
              priority={false}
            />
          </Link>

          <NotificationsBell />

          {!signedIn ? (
            <Link href="/sign-in" className="hx-btn hx-btn--outline-primary text-sm px-3 py-2">
              Sign in
            </Link>
          ) : (
            <button
              onClick={signOut}
              disabled={busy}
              className="hx-btn hx-btn--secondary text-sm px-3 py-2 disabled:opacity-50"
              aria-label="Sign out"
            >
              {busy ? 'Signing out…' : 'Sign out'}
            </button>
          )}
        </div>
      </nav>

      {/* ===== Mobile ===== */}
      <div className="md:hidden px-3 pt-2 pb-1">
        <div className="flex items-center justify-between">
          {/* Left slot: Admin (mods/admins only) */}
          <div>
            {showAdmin && (
              <Link
                href="/admin"
                className="inline-flex items-center rounded-full border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Admin
              </Link>
            )}
          </div>

          {/* Right slot: Facebook -> bell -> sign in/out */}
          <div className="flex items-center gap-2">
            <Link
              href="https://www.facebook.com/groups/harmonicexchangeglobal"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Harmonic Exchange Facebook Group"
              title="Harmonic Exchange Facebook Group"
              className="inline-flex items-center focus:outline-none hover:opacity-90 active:opacity-80"
            >
              <Image
                src="/Facebook-Round-Icon.jpg"
                alt="Facebook"
                width={40}
                height={40}
                className="block"
                priority={false}
              />
            </Link>

            <NotificationsBell />

            {!signedIn ? (
              <Link
                href="/sign-in"
                className="inline-flex items-center rounded-full border border-[var(--hx-brand)] text-[var(--hx-brand)] px-3 py-1.5 text-sm font-medium hover:bg-emerald-50"
              >
                Sign in
              </Link>
            ) : (
              <button
                onClick={signOut}
                disabled={busy}
                className="inline-flex items-center rounded-full border border-gray-300 text-gray-700 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
              >
                {busy ? '…' : 'Sign out'}
              </button>
            )}
          </div>
        </div>

        {/* Mobile icon row */}
        <nav className="mt-2 flex items-center justify-between gap-1 rounded-xl border bg-white px-2 py-1.5" aria-label="Primary">
          <NavIcon href="/"                                        icon={<Icon name="home" />}  label="Home"     active={is('/')} />
          <NavIcon href={signedIn ? '/global' : '/sign-in'}        icon={<Icon name="globe" />} label="Global"   active={is('/global')} />
          <NavIcon href="/offers"                                  icon={<Icon name="swap" />}  label="Exchange" active={isExchangeBucket} />
          <NavIcon href={signedIn ? '/chapters' : '/sign-in'}      icon={<Icon name="map" />}   label="Chapters" active={is('/chapters')} />
          <NavIcon href="/profile"                                 icon={<Icon name="user" />}  label="Profile"  active={is('/profile')} />
        </nav>
      </div>
    </header>
  );
}
