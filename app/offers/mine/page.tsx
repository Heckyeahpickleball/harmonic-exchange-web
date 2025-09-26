'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import OfferCard, { OfferRow } from '@/components/OfferCard';

export default function MyOffersPage() {
  const [rows, setRows] = useState<OfferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setErr(null);
      setLoading(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) {
          setRows([]);
          return;
        }

        const { data, error } = await supabase
          .from('offers')
          .select('id,title,offer_type,is_online,city,country,images,status')
          .eq('owner_id', uid)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setRows((data || []) as OfferRow[]);
      } catch (e: any) {
        setErr(e?.message ?? 'Failed to load offers');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function handleDeleted(id: string) {
    setRows((prev) => prev.filter((o) => o.id !== id));
  }

  return (
    <section className="mx-auto max-w-5xl space-y-4">
      <h1 className="text-2xl font-bold">My Offers</h1>

      {err && <p className="text-sm text-red-700">{err}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : rows.length === 0 ? (
        <p>No offers yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {rows.map((o) => (
            <OfferCard key={o.id} offer={o} mine onDeleted={handleDeleted} />
          ))}
        </div>
      )}
    </section>
  );
}
