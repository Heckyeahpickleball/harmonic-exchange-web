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

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data?.user?.id ?? null;
      setUid(u);
      if (u) {
        const { data: p } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', u)
          .single();
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
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/" className="underline-offset-4 hover:underline">Home</Link>
        <Link href="/browse" className="underline-offset-4 hover:underline">Offerings</Link>
        <Link href="/offers/new" className="underline-offset-4 hover:underline">Share My Value</Link>
        <Link href="/offers/mine" className="underline-offset-4 hover:underline">My Offers</Link>

        <Link href="/messages" className="underline-offset-4 hover:underline">
          Inbox <MessagesUnreadBadge />
        </Link>

        <Link href="/exchanges" className="underline-offset-4 hover:underline">Exchanges</Link>
        <Link href="/profile" className="underline-offset-4 hover:underline">Profile</Link>

        {/* NEW: movement pages */}
        <Link href="/about" className="underline-offset-4 hover:underline">About</Link>
        <Link href="/chapters" className="underline-offset-4 hover:underline">Chapters</Link>
        <Link href="/chapters/start" className="underline-offset-4 hover:underline">Start a Chapter</Link>
        <Link href="/guidelines" className="underline-offset-4 hover:underline">Guidelines</Link>

        {showAdmin && (
          <Link href="/admin" className="underline-offset-4 hover:underline">Admin</Link>
        )}
      </div>

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
