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

/** ------- PASSWORDLESS (magic link) ------- */
export async function sendMagicLink(email: string) {
  if (!email) throw new Error('Email is required');
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${SITE_URL}/auth/callback` },
  });
  if (error) throw error;
  return true;
}

/** ------- OAUTH ------- */
export async function signInWithProvider(provider: OAuthProvider) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${SITE_URL}/auth/callback`,
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) throw error;
  return data?.url || null; // client can window.location.assign(this)
}

/** ------- EMAIL + PASSWORD (used by AuthPanel) ------- */
export async function signInWithEmail(email: string, password: string) {
  if (!email || !password) throw new Error('Email and password are required');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user ?? null;
}

export async function signUpWithEmail(email: string, password: string) {
  if (!email || !password) throw new Error('Email and password are required');
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${SITE_URL}/auth/callback` },
  });
  if (error) throw error;
  return data.user ?? null;
}

/** ------- SESSION HELPERS ------- */
export async function getUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user ?? null;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  return true;
}
