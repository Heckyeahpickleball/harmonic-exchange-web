'use client';

import './globals.css';
import type { ReactNode } from 'react';
import ClientHeaderNav from '@/components/ClientHeaderNav';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans bg-background text-foreground">
        <header className="border-b">
          <div className="mx-auto max-w-5xl px-3">
            <ClientHeaderNav />
          </div>
        </header>
        <main className="mx-auto max-w-5xl p-4">{children}</main>
      </body>
    </html>
  );
}
