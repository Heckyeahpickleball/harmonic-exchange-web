'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import NotificationsBell from '@/components/NotificationsBell';
import MessagesUnreadBadge from '@/components/MessagesUnreadBadge';

type Role = 'user' | 'moderator' | 'admin';

export default function ClientHeaderNav() {
  const [uid, setUid] = useState<string | null>(null);
  const [role, setRole] = useState<Role>('user');
  const [busy, setBusy] = useState(false);

  // dropdown state
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

  return (
    <nav className="flex items-center justify-between gap-3 py-2">
      {/* LEFT: brand + primary links */}
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/" className="underline-offset-4 hover:underline">Home</Link>

        {/* Exchange menu */}
        <div className="relative">
          <button
            className="hx-btn hx-btn--secondary text-sm px-3 py-2"
            onClick={() => {
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
            <div
              className="absolute z-50 mt-2 w-56 hx-card p-2"
              role="menu"
              onMouseLeave={() => setOpenExchange(false)}
            >
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
        <div className="relative">
          <button
            className="hx-btn hx-btn--secondary text-sm px-3 py-2"
            onClick={() => {
              setOpenChapters(v => !v);
              setOpenExchange(false);
              setOpenProfile(false);
            }}
            aria-haspopup="menu"
            aria-expanded={openChapters}
          >
            Local Chapters
          </button>
          {openChapters && (
            <div
              className="absolute z-50 mt-2 w-60 hx-card p-2"
              role="menu"
              onMouseLeave={() => setOpenChapters(false)}
            >
              <Link href="/chapters" className="block rounded px-3 py-2 hover:bg-gray-50" role="menuitem">
                Explore Chapters
              </Link>
              {/* keep the existing route you use for starting a chapter */}
              <Link href="/chapters/start" className="block rounded px-3 py-2 hover:bg-gray-50" role="menuitem">
                Start a Chapter
              </Link>
            </div>
          )}
        </div>

        {/* Profile menu */}
        <div className="relative">
          <button
            className="hx-btn hx-btn--secondary text-sm px-3 py-2"
            onClick={() => {
              setOpenProfile(v => !v);
              setOpenExchange(false);
              setOpenChapters(false);
            }}
            aria-haspopup="menu"
            aria-expanded={openProfile}
          >
            Profile
          </button>
          {openProfile && (
            <div
              className="absolute z-50 mt-2 w-56 hx-card p-2"
              role="menu"
              onMouseLeave={() => setOpenProfile(false)}
            >
              <Link href="/profile" className="block rounded px-3 py-2 hover:bg-gray-50" role="menuitem">
                My Profile
              </Link>
              {/* your Inbox currently lives at /messages */}
              <Link href="/messages" className="block rounded px-3 py-2 hover:bg-gray-50" role="menuitem">
                Inbox <span className="ml-1 align-middle"><MessagesUnreadBadge /></span>
              </Link>
            </div>
          )}
        </div>

        {showAdmin && (
          <Link href="/admin" className="underline-offset-4 hover:underline">Admin</Link>
        )}
      </div>

      {/* RIGHT: bell + auth */}
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
  );
}
