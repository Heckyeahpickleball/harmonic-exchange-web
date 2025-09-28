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

  return (
    <nav className="flex items-center justify-between gap-3 py-2">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/" className="underline-offset-4 hover:underline">Home</Link>
        <Link href="/browse" className="underline-offset-4 hover:underline">Browse</Link>
        <Link href="/offers/new" className="underline-offset-4 hover:underline">New Offer</Link>
        <Link href="/offers/mine" className="underline-offset-4 hover:underline">My Offers</Link>

        <Link href="/messages" className="underline-offset-4 hover:underline">
          Messages <MessagesUnreadBadge />
        </Link>

        <Link href="/exchanges" className="underline-offset-4 hover:underline">Exchanges</Link>
        <Link href="/profile" className="underline-offset-4 hover:underline">Profile</Link>
        {role === 'admin' && (
          <Link href="/admin" className="underline-offset-4 hover:underline">Admin</Link>
        )}
      </div>

      <div className="flex items-center gap-2">
        <NotificationsBell />
        {!uid ? (
          <Link href="/sign-in" className="rounded border px-2 py-1 text-sm hover:bg-gray-50">
            Sign In
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
