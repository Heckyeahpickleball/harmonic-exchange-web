'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import NotificationsBell from '@/components/NotificationsBell';

export default function ClientHeaderNav() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) {
        if (active) setIsAdmin(false);
        return;
      }
      const { data: prof } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', uid)
        .single();

      if (active) {
        const role = (prof?.role ?? 'user') as string;
        setIsAdmin(role === 'admin' || role === 'moderator');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 p-3">
      <div className="flex items-center gap-4">
        <Link href="/">Home</Link>
        <Link href="/offers">Browse</Link>
        <Link href="/offers/new">New Offer</Link>
        <Link href="/offers/mine">My Offers</Link>
        <Link href="/messages">Messages</Link>
        <Link href="/exchanges">Exchanges</Link>
        <Link href="/profile">Profile</Link>
        {isAdmin && <Link href="/admin">Admin</Link>}
      </div>
      <div className="flex items-center gap-4">
        <Link href="/sign-in">Sign In</Link>
        <NotificationsBell />
      </div>
    </nav>
  );
}
