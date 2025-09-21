// /app/layout.tsx
import './globals.css'
import Link from 'next/link'
import AuthInit from '@/components/AuthInit'

export const metadata = {
  title: 'Harmonic Exchange',
  description: 'Gift-based collaboration',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <AuthInit />
        <header className="flex items-center justify-between px-6 py-4">
          <h1 className="font-semibold">Harmonic Exchange</h1>
          <nav className="flex gap-4 text-sm">
            <Link href="/">Home</Link>
            <Link href="/sign-in">Sign In</Link>
            <Link href="/profile">Profile</Link>
          </nav>
        </header>
        <main className="px-6">{children}</main>
      </body>
    </html>
  )
}
