// /components/MessageButton.tsx
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
      // --- 1. Get current user ---
      const { data: auth } = await supabase.auth.getUser();
      const me = auth?.user?.id ?? null;
      if (!me) {
        router.push('/sign-in');
        return;
      }
      if (me === toId) return;

      // --- 2. Try to find existing request ---
      const { data: existing } = await supabase
        .from('requests')
        .select('id, offers!left(owner_id)')
        .or(
          `and(offers.owner_id.eq.${toId},requester_profile_id.eq.${me}),and(offers.owner_id.eq.${me},requester_profile_id.eq.${toId})`
        )
        .order('created_at', { ascending: false })
        .limit(1);

      // --- 3. If none exists, create a minimal one safely ---
      if (!existing || existing.length === 0) {
        // Try to anchor to peer’s most recent offer
        const { data: peerOffers } = await supabase
          .from('offers')
          .select('id')
          .eq('owner_id', toId)
          .order('created_at', { ascending: false })
          .limit(1);

        let finalOfferId = peerOffers?.[0]?.id ?? null;

        // If peer has no offers, create a placeholder offer owned by me
        if (!finalOfferId) {
          const { data: createdOffer, error: offerError } = await supabase
            .from('offers')
            .insert([
              {
                owner_id: me,
                title: 'Direct message',
                // IMPORTANT: offer_type must satisfy your CHECK constraint:
                // use a valid type like 'service'
                offer_type: 'service',
                is_online: true,
                status: 'archived', // safe fallback
                // the rest are nullable in your schema
                city: null,
                country: null,
                images: [],
              },
            ])
            .select('id')
            .single();
          if (offerError) console.warn('Offer insert failed:', offerError);
          finalOfferId = createdOffer?.id ?? null;
        }

        // Create the request — include note to be safe
        if (finalOfferId) {
          const { error: reqError } = await supabase
            .from('requests')
            .insert([{ offer_id: finalOfferId, requester_profile_id: me, note: '' }]);
          if (reqError) console.warn('Request insert failed:', reqError);
        }
      }

      // --- 4. Navigate to chat ---
      router.push(`/messages?thread=${toId}`);
    } catch (err) {
      console.error('Failed to start chat:', err);
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
