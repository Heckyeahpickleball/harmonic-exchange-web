'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

function safeNext(next?: string | null) {
  if (!next) return null;
  try {
    // allow only same-site relative paths like "/profile" or "/x?y"
    if (next.startsWith('/') && !next.startsWith('//')) return next;
  } catch {}
  return null;
}

export default function AuthCallbackPage() {
  const [msg, setMsg] = useState('Finishing sign-in…');

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        const type = url.searchParams.get('type'); // e.g., "recovery"
        const nextParam = safeNext(url.searchParams.get('next'));
        const errParam = url.searchParams.get('error') || url.searchParams.get('error_description');

        // If Supabase sent back an error in the URL, surface it
        if (errParam) {
          if (isMounted) setMsg(`Auth error: ${decodeURIComponent(errParam)}`);
          return;
        }

        // --- Case A: New PKCE flow (?code=...)
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;

          // Clean URL
          window.history.replaceState({}, '', '/');

          // Decide where to go
          const to =
            nextParam ||
            (type === 'recovery' ? '/reset-password' : '/profile');

          window.location.replace(to);
          return;
        }

        // --- Case B: Legacy hash flow (#access_token=...&refresh_token=...)
        if (window.location.hash) {
          const params = new URLSearchParams(window.location.hash.slice(1));
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');

          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });
            if (error) throw error;

            // Clean URL
            window.history.replaceState({}, '', '/');

            const to =
              nextParam ||
              (type === 'recovery' ? '/reset-password' : '/profile');

            window.location.replace(to);
            return;
          }
        }

        // --- Case C: Give Supabase a brief moment to detect the URL hash/params itself
        // (covers rare cases where the client lib processes the fragment on mount)
        setTimeout(async () => {
          const { data, error } = await supabase.auth.getSession();
          if (error) {
            if (isMounted) setMsg(`Auth error: ${error.message}`);
            return;
          }
          if (data.session) {
            window.history.replaceState({}, '', '/');
            const to =
              nextParam ||
              (type === 'recovery' ? '/reset-password' : '/profile');
            window.location.replace(to);
            return;
          }
          if (isMounted) setMsg('Nothing to do here. Try signing in again.');
        }, 300);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('Auth callback error:', err);
        if (isMounted) setMsg(`Sign-in failed: ${message}`);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="max-w-lg p-6">
      <h2 className="mb-2 text-2xl font-bold">Harmonic Exchange</h2>
      <p className="text-sm text-gray-700">{msg}</p>
    </section>
  );
}
