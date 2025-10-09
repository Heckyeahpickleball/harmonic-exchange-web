// components/MessageButton.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

type Props = {
  toId: string;
  className?: string;
  children?: React.ReactNode;
};

export default function MessageButton({ toId, className = '', children }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function startChat() {
    if (!toId) return;
    setBusy(true);
    try {
      // auth
      const { data: auth } = await supabase.auth.getUser();
      const me = auth?.user?.id ?? null;
      if (!me) {
        router.push('/sign-in');
        return;
      }
      if (me === toId) return;

      // find existing request in either direction
      const { data: existing } = await supabase
        .from('requests')
        .select('id, offers!inner(owner_id)')
        .or(
          `and(offers.owner_id.eq.${toId},requester_profile_id.eq.${me}),and(offers.owner_id.eq.${me},requester_profile_id.eq.${toId})`
        )
        .order('created_at', { ascending: false })
        .limit(1);

      if (existing && existing.length > 0) {
        const req = existing[0] as any;
        // ✅ Always route to /messages now
        router.push(`/messages?thread=${req.id}`);
        return;
      }

      // else create anchored to most-recent active offer, if any
      const { data: peerOffers } = await supabase
        .from('offers')
        .select('id')
        .eq('owner_id', toId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1);

      const offerId = peerOffers?.[0]?.id as string | undefined;
      if (!offerId) {
        router.push('/messages');
        return;
      }

      const { data: newReq } = await supabase
        .from('requests')
        .insert([{ offer_id: offerId, requester_profile_id: me }])
        .select('id')
        .single();

      router.push(`/messages?thread=${newReq?.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={startChat}
      disabled={busy || !toId}
      className={[
        'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium',
        'bg-teal-600 text-white hover:bg-teal-700',
        'shadow-sm ring-1 ring-teal-700/20',
        'focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        className,
      ].join(' ')}
      aria-label="Message"
    >
      <MessageSquare className="h-4 w-4" aria-hidden />
      {busy ? 'Opening…' : (children ?? 'Message')}
    </button>
  );
}
