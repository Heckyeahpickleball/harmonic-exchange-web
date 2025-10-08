// components/ClientHeaderNav.tsx
'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
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
  const pathname = usePathname() || '/';
  const [uid, setUid] = useState<string | null>(null);
  const [role, setRole] = useState<Role>('user');
  const [busy, setBusy] = useState(false);

  // dropdowns
  const [openExchange, setOpenExchange] = useState(false);
  const [openChapters, setOpenChapters] = useState(false);
  const [openProfile, setOpenProfile] = useState(false);

  const exchangeRef = useRef<HTMLDivElement | null>(null);
  const chaptersRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);

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

  // click-outside + Escape to close dropdowns (no onMouseLeave)
  useEffect(() => {
    function onDown(e: MouseEvent) {
      const t = e.target as Node | null;
      const hitExchange = exchangeRef.current && t && exchangeRef.current.contains(t);
      const hitChapters = chaptersRef.current && t && chaptersRef.current.contains(t);
      const hitProfile = profileRef.current && t && profileRef.current.contains(t);
      if (!hitExchange) setOpenExchange(false);
      if (!hitChapters) setOpenChapters(false);
      if (!hitProfile) setOpenProfile(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpenExchange(false);
        setOpenChapters(false);
        setOpenProfile(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
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

  return (
    <header className="w-full border-b bg-white">
      {/* ===== Desktop / tablet ===== */}
      <nav className="hidden md:flex items-center justify-between gap-3 py-2 max-w-6xl mx-auto px-4">
        {/* LEFT */}
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/" className="underline-offset-4 hover:underline">Home</Link>

          <Link href="/global" className="hx-btn hx-btn--secondary text-sm px-3 py-2">
            Global Exchange
          </Link>

          {/* Exchange menu */}
          <div className="relative" ref={exchangeRef}>
            <button
              className="hx-btn hx-btn--secondary text-sm px-3 py-2"
              onClick={() => {
                setOpenExchange((v) => !v);
                setOpenChapters(false);
                setOpenProfile(false);
              }}
              aria-haspopup="menu"
              aria-expanded={openExchange}
            >
              Exchange
            </button>
            {openExchange && (
              <div className="absolute z-50 mt-2 w-56 hx-card p-2" role="menu">
                <Link href="/browse" className="block rounded px-3 py-2 hover:bg-gray-50" role="menuitem">
                  Browse Offers
                </Link>
                <Link href="/offers/new" className="block rounded px-3 py-2 hover:bg-gray-50" role="menuitem">
                  New Offer
                </Link>
                <Link href="/exchanges" className="block rounded px-3 py-2 hover:bg-gray-50" role="menuitem">
                  My Exchanges
                </Link>
              </div>
            )}
          </div>

          {/* Local Chapters menu */}
          <div className="relative" ref={chaptersRef}>
            <button
              className="hx-btn hx-btn--secondary text-sm px-3 py-2"
              onClick={() => {
                setOpenChapters((v) => !v);
                setOpenExchange(false);
                setOpenProfile(false);
              }}
              aria-haspopup="menu"
              aria-expanded={openChapters}
            >
              Local Chapters
            </button>
            {openChapters && (
              <div className="absolute z-50 mt-2 w-60 hx-card p-2" role="menu">
                <Link href="/chapters" className="block rounded px-3 py-2 hover:bg-gray-50" role="menuitem">
                  Explore Chapters
                </Link>
                <Link href="/chapters/start" className="block rounded px-3 py-2 hover:bg-gray-50" role="menuitem">
                  Start a Chapter
                </Link>
              </div>
            )}
          </div>

          {/* Profile menu */}
          <div className="relative" ref={profileRef}>
            <button
              className="hx-btn hx-btn--secondary text-sm px-3 py-2"
              onClick={() => {
                setOpenProfile((v) => !v);
                setOpenExchange(false);
                setOpenChapters(false);
              }}
              aria-haspopup="menu"
              aria-expanded={openProfile}
            >
              Profile
            </button>
            {openProfile && (
              <div className="absolute z-50 mt-2 w-56 hx-card p-2" role="menu">
                <Link href="/profile" className="block rounded px-3 py-2 hover:bg-gray-50" role="menuitem">
                  My Profile
                </Link>
                <Link href="/messages" className="block rounded px-3 py-2 hover:bg-gray-50" role="menuitem">
                  Messages <span className="ml-1 align-middle"><MessagesUnreadBadge /></span>
                </Link>
              </div>
            )}
          </div>

          {showAdmin && (
            <Link href="/admin" className="underline-offset-4 hover:underline">Admin</Link>
          )}
        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-2">
          <NotificationsBell />
          {!uid ? (
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

      {/* ===== Mobile: Admin button + bell/sign-out on same line ===== */}
      <div className="md:hidden px-3 pt-2 pb-1">
        <div className="flex items-center justify-between">
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
          <div className="flex items-center gap-2">
            <NotificationsBell />
            {!uid ? (
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

        {/* mobile icon row */}
        <nav className="mt-2 flex items-center justify-between gap-1 rounded-xl border bg-white px-2 py-1.5" aria-label="Primary">
          <NavIcon href="/"        icon={<Icon name="home" />}  label="Home"     active={is('/')} />
          <NavIcon href="/global"  icon={<Icon name="globe" />} label="Global"   active={is('/global')} />
          <NavIcon href="/exchange"icon={<Icon name="swap" />}  label="Exchange" active={is('/exchange')} />
          <NavIcon href="/chapters"icon={<Icon name="map" />}   label="Chapters" active={is('/chapters')} />
          <NavIcon href="/profile" icon={<Icon name="user" />}  label="Profile"  active={is('/profile')} />
        </nav>
      </div>
    </header>
  );
}
