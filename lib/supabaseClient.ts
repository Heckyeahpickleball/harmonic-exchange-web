// /lib/supabaseClient.ts
'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Make sure we only ever have ONE Supabase client in the browser.
 * This avoids re-connecting Realtime channels on re-renders/HMR
 * and keeps message switching feeling instant.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Augment the global type so TS lets us stash a singleton on window/globalThis.
declare global {
  // eslint-disable-next-line no-var
  var __HX_SUPABASE__: SupabaseClient | undefined;
}

function makeBrowserClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    // This will surface quickly if env vars are missing in local or Vercel.
    console.warn('Supabase env vars are missing: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    // A tiny header is handy for tracing, optional:
    global: { headers: { 'x-client-info': 'harmonic-exchange-web' } },
    // (optional) throttle server-sent events if you want:
    // realtime: { params: { eventsPerSecond: 10 } },
  });
}

// Reuse the same client across renders/HMR in dev and across the app in prod.
export const supabase: SupabaseClient =
  globalThis.__HX_SUPABASE__ ?? (globalThis.__HX_SUPABASE__ = makeBrowserClient());

// Convenience getter if you prefer calling a function:
export function getSupabaseClient(): SupabaseClient {
  return supabase;
}
