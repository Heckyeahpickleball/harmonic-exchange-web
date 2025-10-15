import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!; // SERVER-ONLY

const admin = createClient(url, serviceRole, { auth: { persistSession: false } });

type AnyRow = Record<string, any>;

function normalizeRows(rows: AnyRow[], source: string) {
  return (rows ?? []).map((r) => {
    const quote =
      r.quote ??
      r.message ??     // `gratitudes` text column
      r.text ??
      r.body ??
      r.content ??
      null;

    return {
      id: r.id,
      created_at: r.created_at,
      quote,
      rating: typeof r.rating === 'number' ? r.rating : null,
      author_id: r.receiver_profile_id ?? r.author_id ?? null,
      subject_id: r.owner_profile_id ?? r.subject_id ?? null,
      offer_id: r.offer_id ?? null,
      request_id: r.request_id ?? null,
      author_name: r.author_name ?? null,
      subject_name: r.subject_name ?? r.subject_title ?? null,
      _source: source,
    };
  });
}

export async function GET() {
  try {
    // Fetch from ALL likely locations in parallel.
    const [rg, rv, gr] = await Promise.allSettled([
      admin.from('review_gratitudes').select('*').order('created_at', { ascending: false }).limit(400),
      admin.from('reviews').select('*').order('created_at', { ascending: false }).limit(400),
      admin.from('gratitudes').select('*').order('created_at', { ascending: false }).limit(400),
    ]);

    const pools: AnyRow[] = [];

    // review_gratitudes (table or view)
    if (rg.status === 'fulfilled' && !rg.value.error && rg.value.data?.length) {
      pools.push(...normalizeRows(rg.value.data as AnyRow[], 'review_gratitudes'));
    }

    // reviews
    if (rv.status === 'fulfilled' && !rv.value.error && rv.value.data?.length) {
      pools.push(...normalizeRows(rv.value.data as AnyRow[], 'reviews'));
    }

    // gratitudes (your confirmed working source)
    if (gr.status === 'fulfilled' && !gr.value.error && gr.value.data?.length) {
      pools.push(...normalizeRows(gr.value.data as AnyRow[], 'gratitudes'));
    }

    // If nothing came back at all
    if (!pools.length) {
      return NextResponse.json({ source: 'none', items: [] });
    }

    // De-duplicate by id, prefer latest created_at
    const byId = new Map<string, AnyRow>();
    for (const r of pools) {
      if (!r.id) continue;
      const prev = byId.get(r.id);
      if (!prev || new Date(r.created_at).getTime() > new Date(prev.created_at).getTime()) {
        byId.set(r.id, r);
      }
    }

    // Only show rows that actually have text
    const items = Array.from(byId.values()).filter((n) => n.quote && String(n.quote).trim().length > 0);

    // Hydrate names if missing
    const need = items.filter((n) => (n.author_id && !n.author_name) || (n.subject_id && !n.subject_name));
    if (need.length) {
      const ids = Array.from(
        new Set(need.flatMap((n) => [n.author_id, n.subject_id].filter(Boolean) as string[]))
      );
      if (ids.length) {
        const { data: profs } = await admin.from('profiles').select('id,display_name').in('id', ids);
        const map = new Map<string, string>();
        (profs ?? []).forEach((p: any) => map.set(p.id, p.display_name));
        items.forEach((n) => {
          if (n.author_id && !n.author_name) n.author_name = map.get(n.author_id) ?? null;
          if (n.subject_id && !n.subject_name) n.subject_name = map.get(n.subject_id) ?? null;
        });
      }
    }

    // Sort newest first post-merge
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Surface the dominant source for your little label if you want it
    const dominant =
      items.find((x) => x._source === 'review_gratitudes') ? 'review_gratitudes' :
      items.find((x) => x._source === 'reviews') ? 'reviews' :
      'gratitudes';

    return NextResponse.json({ source: dominant, items });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message ?? 'Failed to load reviews' }, { status: 500 });
  }
}
