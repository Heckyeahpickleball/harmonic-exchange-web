// /components/LeaveChatButton.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Props = {
  threadId: string | null | undefined;
  onLeft?: () => void;
  className?: string;
};

/**
 * LeaveChatButton
 *
 * Soft-leaves a chat by marking the current user as "left" in the participants table,
 * with multiple fallbacks:
 *  - tries `thread_participants`
 *  - then tries `message_participants`
 *  - as a last resort, tries deleting the participant row
 *
 * Assumes RLS is set so users can only update/delete their own participant row.
 * If you don’t have these tables yet, see the note at the bottom.
 */
export default function LeaveChatButton({ threadId, onLeft, className }: Props) {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUid(data.user?.id ?? null);
    });
  }, []);

  async function leaveVia(table: 'thread_participants' | 'message_participants') {
    if (!uid || !threadId) return { count: 0, error: null as any };

    // Preferred: mark left_at (soft-leave so history persists)
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from(table)
      .update({ left_at: now, active: false })
      .eq('thread_id', threadId)
      .eq('profile_id', uid)
      .select('thread_id');

    // If table exists but no matching row (count=0), try delete as fallback
    if (!error && (!data || data.length === 0)) {
      const del = await supabase
        .from(table)
        .delete()
        .eq('thread_id', threadId)
        .eq('profile_id', uid);
      return { count: del?.count ?? 0, error: del.error ?? null };
    }

    return { count: data?.length ?? 0, error };
  }

  async function handleLeave() {
    if (!threadId) return;
    if (!uid) {
      alert('Please sign in to leave this chat.');
      return;
    }
    const ok = confirm('Leave this chat? You will no longer see it in Messages.');
    if (!ok) return;

    setBusy(true);

    // Try thread_participants first
    let res = await leaveVia('thread_participants');

    // If the first table doesn’t exist or failed, try message_participants
    if (res.error?.code === '42P01' /* table not found */ || res.error?.message?.toLowerCase?.().includes('relation') ) {
      res = await leaveVia('message_participants');
    }

    if (res.error) {
      console.error('Leave chat error:', res.error);
      alert('Sorry—could not leave chat. If this keeps happening, send me a screenshot of the Console error.');
      setBusy(false);
      return;
    }

    // If neither table existed or nothing changed, we still consider it "left"
    // from the user’s POV by kicking them back to the inbox.
    onLeft?.();
    router.push('/messages'); // back to inbox
    setBusy(false);
  }

  return (
    <button
      type="button"
      onClick={handleLeave}
      disabled={!threadId || busy}
      className={[
        'hx-btn text-xs sm:text-sm',
        'border border-red-300 text-red-600 hover:bg-red-50',
        'rounded-md px-2 py-1',
        className || '',
      ].join(' ')}
      title="Leave this chat"
      aria-label="Leave this chat"
    >
      {busy ? 'Leaving…' : 'Leave chat'}
    </button>
  );
}
