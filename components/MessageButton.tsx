// components/MessageButton.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Props = {
  peerId: string;        // profile id of the person whose profile we're viewing
  className?: string;
  children?: React.ReactNode; // optional custom button label
};

export default function MessageButton({ peerId, className, children }: Props) {
  const router = useRouter();
  const [me, setMe] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data?.user?.id ?? null;
      setMe(uid);
      if (uid && uid === peerId) setHidden(true); // don’t show on your own profile
    })();
  }, [peerId]);

  const goToMessages = async () => {
    if (!me || !peerId || me === peerId) return;
    setBusy(true);

    try {
      // 1) Do we already have any request with this peer (either direction)?
      //    We consider requests where the peer owns the offer and I’m the requester,
      //    or I own the offer and they requested.
      const { data: existing } = await supabase
        .from('requests')
        .select('id, offer_id, requester_profile_id, offers!inner(id, owner_id)')
        .or(
          `and(offers.owner_id.eq.${peerId},requester_profile_id.eq.${me}),and(offers.owner_id.eq.${me},requester_profile_id.eq.${peerId})`
        )
        .order('created_at', { ascending: false })
        .limit(1);

      if (existing && existing.length > 0) {
        // We have history → route by peer id so the “peer-grouped” messages page selects that thread.
        router.push(`/messages?thread=${peerId}`);
        return;
      }

      // 2) No existing thread: pick one of the peer’s offers to anchor the conversation.
      const { data: offers, error: offersErr } = await supabase
        .from('offers')
        .select('id')
        .eq('owner_id', peerId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (offersErr) throw offersErr;
      const offerId = offers?.[0]?.id as string | undefined;

      if (!offerId) {
        // Fallback: if they have no offers, just open the peer thread.
        // (You won’t be able to send until an offer/request exists, but at least it opens.)
        router.push(`/messages?thread=${peerId}`);
        return;
      }

      // 3) Create a minimal request so sending works immediately.
      const { data: newReq, error: insertErr } = await supabase
        .from('requests')
        .insert([{ offer_id: offerId, requester_profile_id: me }])
        .select('id')
        .single();

      if (insertErr) throw insertErr;

      // 4) Route to messages using the new request id (guarantees composer is enabled).
      router.push(`/messages?request=${newReq.id}`);
    } catch (e) {
      console.warn('Start chat failed', e);
      // Safe fallback: at least land in the right peer thread.
      router.push(`/messages?thread=${peerId}`);
    } finally {
      setBusy(false);
    }
  };

  if (hidden) return null;

  return (
    <button
      type="button"
      onClick={goToMessages}
      disabled={!me || busy}
      className={className ?? 'rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-60'}
      aria-label="Message"
      title="Message"
    >
      {busy ? 'Opening…' : (children ?? 'Message')}
    </button>
  );
}
