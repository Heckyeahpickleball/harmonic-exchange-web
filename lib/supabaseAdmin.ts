// lib/supabaseAdmin.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Lazily creates a singleton service-role client.
 * This avoids evaluating createClient() during the build step,
 * which can throw "supabaseKey is required" on Vercel.
 */
let _admin: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (_admin) return _admin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error('SUPABASE: NEXT_PUBLIC_SUPABASE_URL is missing');
  if (!serviceKey) throw new Error('SUPABASE: SUPABASE_SERVICE_ROLE_KEY is missing');

  _admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'X-Client-Info': 'hx-admin-route' } },
  });

  return _admin;
}
