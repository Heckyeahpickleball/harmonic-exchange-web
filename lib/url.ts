// /lib/url.ts
export function getBaseUrl() {
  // Browser first (helps with preview deployments)
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL!;
      if (process.env.NEXT_PUBLIC_VERCEL_URL) return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
    }
    return origin;
  }

  // Server-side / build-time
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL!;
  if (process.env.NEXT_PUBLIC_VERCEL_URL) return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;

  return 'http://localhost:3000';
}

export function getAuthCallbackUrl() {
  return `${getBaseUrl()}/auth/callback`;
}

export function getResetCallbackUrl() {
  return `${getBaseUrl()}/auth/callback?type=recovery`;
}
