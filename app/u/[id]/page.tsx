// /app/u/[id]/page.tsx
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import OfferCard, { type OfferRow } from '@/components/OfferCard';

type ProfileRow = {
  id: string;
  display_name: string | null;
  bio?: string | null;
};

function ProfileContent() {
  const params = useParams<{ id: string }>();
  const profileId = params?.id;

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string>('');

  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setMsg('');

      try {
        // Profile
        const { data: p, error: pErr } = await supabase
          .from('profiles')
          .select('id, display_name, bio')
          .eq('id', profileId)
          .single();
        if (pErr) throw pErr;
        if (!cancelled) setProfile(p as ProfileRow);

        // Owner's active offers (note the column names: offer_type, is_online, etc.)
        const { data: o, error: oErr } = await supabase
          .from('offers')
          .select(
            'id, title, offer_type, is_online, city, country, images, status'
          )
          .eq('owner_id', profileId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(100);
        if (oErr) throw oErr;

        // Map to OfferRow; include owner_name for card display
        const list: OfferRow[] = (o || []).map((row: any) => ({
          id: row.id,
          title: row.title,
          offer_type: row.offer_type,
          is_online: row.is_online,
          city: row.city,
          country: row.country,
          status: row.status,
          images: row.images ?? [],
          owner_name: (p as any)?.display_name ?? '—',
        }));

        if (!cancelled) setOffers(list);
      } catch (e: any) {
        if (!cancelled) setMsg(e?.message ?? 'Failed to load profile.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profileId]);

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">{profile?.display_name || 'Profile'}</h1>
      {profile?.bio && (
        <p className="max-w-2xl whitespace-pre-wrap text-sm text-gray-700">
          {profile.bio}
        </p>
      )}

      <h2 className="mt-4 text-xl font-semibold">Active Offers</h2>
      {msg && <p className="text-sm text-amber-700">{msg}</p>}
      {loading ? (
        <p className="text-sm text-gray-600">Loading…</p>
      ) : offers.length === 0 ? (
        <p className="text-sm text-gray-600">No active offers.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {offers.map((o) => (
            <OfferCard key={o.id} offer={o} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function PublicProfilePage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-600">Loading profile…</div>}>
      <ProfileContent />
    </Suspense>
  );
}
