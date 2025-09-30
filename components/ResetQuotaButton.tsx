'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function ResetQuotaButton({ profileId }: { profileId: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function onReset() {
    setErr('');
    const ok = confirm(
      'Reset request quota?\n\nThis will set this member’s 30-day window to start now, allowing up to 3 new asks.\nProceed?'
    );
    if (!ok) return;

    try {
      setBusy(true);
      const { error } = await supabase.rpc('reset_request_quota', { p_profile_id: profileId });
      if (error) throw error;
      alert('Quota reset. They can ask up to 3 times in the next 30 days.');
    } catch (e: any) {
      setErr(e?.message ?? 'Could not reset quota.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onReset}
        disabled={busy}
        className="hx-btn hx-btn--ghost disabled:opacity-50"
        aria-label="Reset monthly ask quota"
      >
        {busy ? 'Resetting…' : 'Reset ask quota'}
      </button>
      {err && <span className="text-sm text-red-600">{err}</span>}
    </div>
  );
}
