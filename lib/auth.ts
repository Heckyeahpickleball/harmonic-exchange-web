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

/** Build the "waiting for authorization" URL with the user's email */
export function pendingVerificationUrl(email: string) {
  return `${SITE_URL}/auth/pending?email=${encodeURIComponent(email)}`;
}

/** ---------- PASSWORDLESS (magic link) ----------
 * Matches AuthPanel usage: returns { error: null } on success.
 */
export async function sendMagicLink(email: string): Promise<{ error: null }> {
  if (!email) throw new Error('Email is required');
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${SITE_URL}/auth/callback` },
  });
  if (error) throw error;
  return { error: null };
}

/** ---------- OAUTH ---------- */
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

/** ---------- EMAIL + PASSWORD ---------- */
export async function signInWithEmail(email: string, password: string) {
  if (!email || !password) throw new Error('Email and password are required');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user ?? null; // keep existing behavior (may be used elsewhere)
}

/** Matches AuthPanel usage: returns { error: null } on success.
 * Also provides a pendingUrl so the UI can immediately redirect to a "Waiting for authorization" screen.
 */
export async function signUpWithEmail(
  email: string,
  password: string
): Promise<{ error: null; pendingUrl: string }> {
  if (!email || !password) throw new Error('Email and password are required');
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Keep normal email verification flow (user clicks the email link)
      emailRedirectTo: `${SITE_URL}/auth/callback`,
    },
  });
  if (error) throw error;

  // Let the caller immediately send the user to the pending screen
  return { error: null, pendingUrl: pendingVerificationUrl(email) };
}

/** Optional helper to allow a "Resend verification email" button on the pending page */
export async function resendSignupVerification(email: string): Promise<{ error: null }> {
  if (!email) throw new Error('Email is required');
  const { error } = await supabase.auth.resend({ type: 'signup', email });
  if (error) throw error;
  return { error: null };
}

/** ---------- SESSION HELPERS ---------- */
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
