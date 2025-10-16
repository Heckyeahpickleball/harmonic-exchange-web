// /app/auth/pending/PendingClient.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function PendingClient() {
  const params = useSearchParams();
  const router = useRouter();
  const email = params.get('email') ?? '';

  const [err, setErr] = useState('');
  const [cooldown, setCooldown] = useState(60);
  const canResend = useMemo(() => cooldown <= 0, [cooldown]);

  useEffect(() => {
    const t = setInterval(() => setCooldown((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  async function resend() {
    try {
      setErr('');
      const { error } = await supabase.auth.resend({ type: 'signup', email });
      if (error) {
        setErr(error.message || 'Unable to resend at the moment.');
        return;
      }
      setCooldown(60);
    } catch (e: any) {
      setErr(e?.message ?? 'Something went wrong.');
    }
  }

  return (
    <>
      <h1 className="mb-2 text-2xl font-semibold">Check your email</h1>
      <p className="text-sm text-gray-600">
        We sent a verification link to <span className="font-medium">{email}</span>. Click the link
        to finish creating your account.
      </p>

      <div className="mt-6 space-y-3">
        <button
          onClick={() => router.push('/')}
          className="w-full rounded-md border px-4 py-2 text-sm"
        >
          Back home
        </button>

        <button
          onClick={resend}
          disabled={!canResend || !email}
          className="w-full rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {canResend ? 'Resend verification email' : `You can resend in ${cooldown}s`}
        </button>

        <button
          onClick={() => router.push('/signin')}
          className="w-full rounded-md border px-4 py-2 text-sm"
        >
          Back to sign in
        </button>
      </div>

      {err && <p className="mt-4 text-sm text-amber-700">{err}</p>}

      <p className="mt-6 text-xs text-gray-500">
        Tip: check your spam folder. If you still don’t see it after a minute, use “Resend”.
      </p>
    </>
  );
}
