// components/ClientHeaderNav.tsx
'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabaseClient';

// Client-only widgets
const NotificationsBell = dynamic(() => import('@/components/NotificationsBell'), {
  ssr: false,
  loading: () => <div aria-label="Notifications" className="w-6 h-6" />,
});
const MessagesUnreadBadge = dynamic(() => import('@/components/MessagesUnreadBadge'), {
  ssr: false,
  loading: () => null,
});

type Role = 'user' | 'moderator' | 'admin';

function Menu({
  summary,
  widthClass = 'w-56',
  children,
}: {
  summary: string;
  widthClass?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement | null>(null);

  // Close when clicking any item inside the panel
  const handlePanelClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('a,[role="menuitem"],button')) {
      if (ref.current) ref.current.open = false;
    }
  };

  return (
    <details ref={ref} className="relative">
      <summary className="list-none hx-btn hx-btn--secondary px-3 py-2 text-sm cursor-pointer select-none">
        {summary}
      </summary>

      {/* The panel stays open when moving from the button to here;
          it closes only when the cursor leaves the PANEL area. */}
      <div
        className={`hx-card absolute z-50 mt-2 ${widthClass} p-2`}
        role="menu"
        onMouseLeave={() => {
          if (ref.current) ref.current.open = false;
        }}
        onClick={handlePanelClick}
      >
        {children}
      </div>
    </details>
  );
}

export default function ClientHeaderNav() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [role, setRole] = useState<Role>('user');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!alive) return;
      const u = data?.user?.id ?? null;
      setUid(u);
      if (u) {
        const { data: p } = await supabase.from('profiles').select('role').eq('id', u).single();
        if (!alive) return;
        if (p?.role) setRole(p.role as Role);
      }
      setMounted(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function signOut() {
    try {
      setBusy(true);
      await supabase.auth.signOut();
      router.push('/');
    } finally {
      setBusy(false);
    }
  }

  const showAdmin = role === 'admin' || role === 'moderator';

  return (
    <nav
      className="relative z-[1000] flex items-center justify-between gap-3 py-2"
      role="navigation"
      aria-label="Primary"
    >
      {/* LEFT: brand + menus */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Home */}
        <Link href="/" className="underline-offset-4 hover:underline">
          Home
        </Link>

        {/* Global Exchange */}
        <Link href="/global" className="hx-btn hx-btn--secondary px-3 py-2 text-sm">
          Global Exchange
        </Link>

        {/* Exchange */}
        <Menu summary="Exchange">
          <Link href="/offers" className="block rounded px-3 py-2 hover:bg-gray-50" role="menuitem">
            Browse Offers
          </Link>
          <Link href="/offers/new" className="block rounded px-3 py-2 hover:bg-gray-50" role="menuitem">
            New Offer
          </Link>
          <Link href="/exchanges" className="block rounded px-3 py-2 hover:bg-gray-50" role="menuitem">
            My Exchanges
          </Link>
        </Menu>

        {/* Local Chapters */}
        <Menu summary="Local Chapters" widthClass="w-60">
          <Link href="/chapters" className="block rounded px-3 py-2 hover:bg-gray-50" role="menuitem">
            Explore Chapters
          </Link>
          <Link href="/chapters/start" className="block rounded px-3 py-2 hover:bg-gray-50" role="menuitem">
            Start a Chapter
          </Link>
        </Menu>

        {/* Profile */}
        <Menu summary="Profile" widthClass="w-56">
          <Link href="/profile" className="block rounded px-3 py-2 hover:bg-gray-50" role="menuitem">
            My Profile
          </Link>
          <Link href="/inbox" className="block rounded px-3 py-2 hover:bg-gray-50" role="menuitem">
            Inbox <span className="ml-1 align-middle"><MessagesUnreadBadge /></span>
          </Link>
        </Menu>

        {/* Admin (if role) */}
        {showAdmin && (
          <Link href="/admin" className="underline-offset-4 hover:underline">
            Admin
          </Link>
        )}
      </div>

      {/* RIGHT: bell + auth */}
      <div className="flex items-center gap-3">
        {/* Notification bell (client-only, hardened) */}
        {mounted && <NotificationsBell />}

        {!mounted ? (
          <span className="hx-btn hx-btn--outline-primary px-3 py-2 text-sm opacity-60">Sign in</span>
        ) : !uid ? (
          <Link href="/sign-in" className="hx-btn hx-btn--outline-primary px-3 py-2 text-sm">
            Sign in
          </Link>
        ) : (
          <button
            onClick={signOut}
            disabled={busy}
            className="hx-btn hx-btn--secondary px-3 py-2 text-sm disabled:opacity-50"
            aria-label="Sign out"
          >
            {busy ? 'Signing out…' : 'Sign out'}
          </button>
        )}
      </div>
    </nav>
  );
}
