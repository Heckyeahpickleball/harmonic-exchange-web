// /lib/auth.ts
import { supabase } from '@/lib/supabaseClient';

export type OAuthProvider =
  | 'google'
  | 'github'
  | 'facebook'
  | 'apple'
  | 'discord'
  | 'twitter'
  | 'linkedin'
  | 'notion'
  | 'slack'
  | 'twitch'
  | 'gitlab'
  | 'bitbucket';

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '') ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

/** Send a passwordless magic-link email */
export async function sendMagicLink(email: string) {
  if (!email) throw new Error('Email is required');
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${SITE_URL}/auth/callback` },
  });
  if (error) throw error;
  return true;
}

/** Begin an OAuth sign-in flow */
export async function signInWithProvider(provider: OAuthProvider) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${SITE_URL}/auth/callback`,
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) throw error;
  return data?.url || null;
}

/** Email + password sign-in (only if you support it) */
export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user ?? null;
}

/** Get current user (client-side) */
export async function getUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user ?? null;
}

/** Sign out */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  return true;
}
