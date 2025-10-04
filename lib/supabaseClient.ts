// /lib/supabaseClient.ts
'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Browser-only singleton Supabase client.
 * Keeps Realtime channels from reconnecting on every re-render/HMR.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Surface clearly in dev/preview; don't throw (site should still render).
  console.warn(
    '[supabaseClient] Missing env: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY'
  );
}

declare global {
  // eslint-disable-next-line no-var
  var __HX_SUPABASE__: SupabaseClient | undefined;
}

function makeBrowserClient(): SupabaseClient {
  return createClient(SUPABASE_URL || '', SUPABASE_ANON_KEY || '', {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      headers: { 'x-client-info': 'harmonic-exchange-web' },
    },
    // Example throttle if needed:
    // realtime: { params: { eventsPerSecond: 10 } },
  });
}

// Reuse the same client across renders/HMR in dev and across the app in prod.
export const supabase: SupabaseClient =
  globalThis.__HX_SUPABASE__ ?? (globalThis.__HX_SUPABASE__ = makeBrowserClient());

export function getSupabaseClient(): SupabaseClient {
  return supabase;
}
