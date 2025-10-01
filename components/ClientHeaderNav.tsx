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

  // local menu state
  const [openExplore, setOpenExplore] = useState(false);
  const [openMove, setOpenMove] = useState(false);

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

        {/* Explore menu */}
        <div className="relative">
          <button
            className="hx-btn hx-btn--secondary text-sm px-3 py-2"
            onClick={() => {
              setOpenExplore((v) => !v);
              setOpenMove(false);
            }}
            aria-haspopup="menu"
            aria-expanded={openExplore}
          >
            Explore
          </button>
          {openExplore && (
            <div
              className="absolute z-50 mt-2 w-56 hx-card p-2"
              role="menu"
              onMouseLeave={() => setOpenExplore(false)}
            >
              <Link href="/browse" className="block rounded px-3 py-2 hover:bg-gray-50" role="menuitem">
                Offerings
              </Link>
              <Link href="/offers/new" className="block rounded px-3 py-2 hover:bg-gray-50" role="menuitem">
                Share My Value
              </Link>
              <Link href="/offers/mine" className="block rounded px-3 py-2 hover:bg-gray-50" role="menuitem">
                My Offers
              </Link>
              <Link href="/exchanges" className="block rounded px-3 py-2 hover:bg-gray-50" role="menuitem">
                Exchanges
              </Link>
              <Link href="/messages" className="block rounded px-3 py-2 hover:bg-gray-50" role="menuitem">
                Inbox <span className="ml-1 align-middle"><MessagesUnreadBadge /></span>
              </Link>
              <Link href="/profile" className="block rounded px-3 py-2 hover:bg-gray-50" role="menuitem">
                Profile
              </Link>
            </div>
          )}
        </div>

        {/* Movement menu */}
        <div className="relative">
          <button
            className="hx-btn hx-btn--secondary text-sm px-3 py-2"
            onClick={() => {
              setOpenMove((v) => !v);
              setOpenExplore(false);
            }}
            aria-haspopup="menu"
            aria-expanded={openMove}
          >
            Movement
          </button>
          {openMove && (
            <div
              className="absolute z-50 mt-2 w-60 hx-card p-2"
              role="menu"
              onMouseLeave={() => setOpenMove(false)}
            >
              <Link href="/about" className="block rounded px-3 py-2 hover:bg-gray-50" role="menuitem">
                About the Movement
              </Link>
              <Link href="/chapters" className="block rounded px-3 py-2 hover:bg-gray-50" role="menuitem">
                Local Chapters
              </Link>
              <Link href="/chapters/start" className="block rounded px-3 py-2 hover:bg-gray-50" role="menuitem">
                Start a Chapter
              </Link>
              <Link href="/guidelines" className="block rounded px-3 py-2 hover:bg-gray-50" role="menuitem">
                Community Guidelines
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
