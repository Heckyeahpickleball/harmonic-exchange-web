// app/layout.tsx
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
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) {
        if (mounted) setRole(null);
        return;
      }

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
      <body className="min-h-screen font-sans bg-background text-foreground">
        <header className="border-b">
          <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 p-3">
            <div className="flex items-center gap-4">
              <Link className="hover:underline" href="/">Home</Link>
              <Link className="hover:underline" href="/offers">Browse</Link>
              <Link className="hover:underline" href="/offers/new">New Offer</Link>
              <Link className="hover:underline" href="/offers/mine">My Offers</Link>
              <Link className="hover:underline" href="/messages">Messages</Link>
              <Link className="hover:underline" href="/exchanges">Exchanges</Link>
              <Link className="hover:underline" href="/profile">Profile</Link>
              {(role === 'admin' || role === 'moderator') && (
                <Link className="hover:underline" href="/admin">Admin</Link>
              )}
            </div>
            <div className="flex items-center gap-4">
              <Link className="hover:underline" href="/sign-in">Sign In</Link>
              <NotificationsBell />
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl p-4">{children}</main>
      </body>
    </html>
  );
}
