'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function AskWindowUsage({ profileId }: { profileId: string }) {
  const [count, setCount] = useState<number | null>(null);
  const [err, setErr] = useState('');

  async function load() {
    try {
      const { data, error } = await supabase
        .from('profile_request_window_usage')
        .select('asks_in_window')
        .eq('profile_id', profileId)
        .maybeSingle();
      if (error) throw error;
      setCount((data?.asks_in_window as number | undefined) ?? 0);
    } catch (e: any) {
      setErr(e?.message ?? 'err');
    }
  }

  useEffect(() => {
    load();
  }, [profileId]);

  // expose a way to refetch after a reset
  (AskWindowUsage as any)._reload = load;

  if (err) return <span className="text-xs text-red-600">window err</span>;
  if (count === null) return <span className="text-xs text-gray-500">…</span>;
  return <span className="text-xs text-gray-700">Asks used (30d): <b>{count}/3</b></span>;
}
