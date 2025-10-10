// /lib/auth.ts
'use client';

import { supabase } from '@/lib/supabaseClient';

/** Works on Vercel custom domain, preview URLs, and localhost */
export function getSiteURL() {
  if (typeof window !== 'undefined') return window.location.origin;
  // SSR fallback (rarely used with these helpers but here for completeness)
  const publicUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (publicUrl) return publicUrl.replace(/\/$/, '');
  // As a last resort, assume same-origin root
  return '';
}

export function getAuthRedirectPath() {
  // Where Supabase should send users back after OAuth/magic link
  return '/auth/callback';
}

export function getResetPasswordPath() {
  return '/reset-password';
}

export function getRedirectURL(path = getAuthRedirectPath()) {
  const base = getSiteURL();
  return base ? `${base}${path}` : path;
}

export async function signUpWithEmail(email: string, password: string) {
  return supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: getRedirectURL(getAuthRedirectPath()),
      data: {}, // add public user metadata here if desired
    },
  });
}

export async function signInWithEmail(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function sendMagicLink(email: string) {
  return supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: getRedirectURL(getAuthRedirectPath()) },
  });
}

export async function signInWithProvider(provider: 'google' | 'github' | 'facebook' | 'apple') {
  return supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: getRedirectURL(getAuthRedirectPath()),
      skipBrowserRedirect: false,
      queryParams: { prompt: 'select_account' },
    },
  });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session ?? null;
}
