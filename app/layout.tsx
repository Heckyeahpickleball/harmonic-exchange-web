// File: app/layout.tsx
'use client';

import './globals.css';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import NotificationsBell from '@/components/NotificationsBell';
import { supabase } from '@/lib/supabaseClient';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadRole() {
      // get current user
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) {
        if (mounted) setRole(null);
        return;
      }

      // read their profile role
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', uid)
        .single();

      if (mounted) setRole(data?.role ?? null);
    }

    loadRole();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <html lang="en">
      <body>
        <header className="border-b">
          <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 p-3">
            <div className="flex items-center gap-4">
              <Link href="/">Home</Link>
              <Link href="/offers">Browse</Link>
              <Link href="/offers/new">New Offer</Link>
              <Link href="/offers/mine">My Offers</Link>
              <Link href="/messages">Messages</Link>
              <Link href="/exchanges">Exchanges</Link>
              <Link href="/profile">Profile</Link>
              {(role === 'admin' || role === 'moderator') && <Link href="/admin">Admin</Link>}

            </div>
            <div className="flex items-center gap-4">
              <Link href="/sign-in">Sign In</Link>
              <NotificationsBell />
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl p-4">{children}</main>
      </body>
    </html>
  );
}
