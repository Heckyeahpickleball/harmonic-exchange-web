// /app/layout.tsx
'use client';

import './globals.css';
import { ReactNode } from 'react';
import ClientHeaderNav from '@/components/ClientHeaderNav';
import { AuthProvider } from '@/components/AuthProvider';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans bg-background text-foreground">
        <AuthProvider>
          <header className="border-b">
            <div className="mx-auto max-w-5xl px-3">
              <ClientHeaderNav />
            </div>
          </header>
          <main className="mx-auto max-w-5xl p-4">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
