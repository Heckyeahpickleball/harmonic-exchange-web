// /lib/supabaseClient.ts
'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * One Supabase client in the browser (singleton).
 * Avoids reconnecting Realtime channels on re-renders/HMR.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Allow stashing a singleton on the global.
declare global {
  // eslint-disable-next-line no-var
  var __HX_SUPABASE__: SupabaseClient | undefined;
}

function makeBrowserClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    // Soft warn rather than throwing so local builds don't crash hard.
    console.warn(
      'Supabase env vars are missing: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  }

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true, // handles /auth/callback
      flowType: 'pkce',
    },
    global: { headers: { 'x-client-info': 'harmonic-exchange-web' } },
  });

  // Keep tokens refreshed reliably on tab focus (common pro pattern).
  if (typeof window !== 'undefined') {
    let refreshing = false;
    const ensureFresh = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const { data } = await client.auth.getSession();
        const exp = data.session?.expires_at ?? 0;
        const now = Math.floor(Date.now() / 1000);
        // If expiring within 2 mins, force a refresh (supabase-js will no-op if unnecessary)
        if (exp && exp - now < 120) {
          await client.auth.refreshSession();
        }
      } finally {
        refreshing = false;
      }
    };
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') ensureFresh();
    });
  }

  return client;
}

// Reuse the same client across renders/HMR in dev and across the app in prod.
export const supabase: SupabaseClient =
  globalThis.__HX_SUPABASE__ ?? (globalThis.__HX_SUPABASE__ = makeBrowserClient());

// Convenience getter
export function getSupabaseClient(): SupabaseClient {
  return supabase;
}
