import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!; // SERVER-ONLY

const admin = createClient(url, serviceRole, { auth: { persistSession: false } });

export async function GET() {
  try {
    // Prefer view if you ever create it; otherwise we'll fall back to gratitudes.
    let source: 'review_gratitudes' | 'reviews' | 'gratitudes' = 'review_gratitudes';
    let rows: any[] = [];

    // A) try view
    {
      const { data, error } = await admin
        .from('review_gratitudes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (!error && data && data.length) {
        rows = data;
        source = 'review_gratitudes';
      }
    }

    // B) try reviews table
    if (rows.length === 0) {
      const { data, error } = await admin
        .from('reviews')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (!error && data && data.length) {
        rows = data;
        source = 'reviews';
      }
    }

    // C) final fallback: gratitudes (your real data source)
    if (rows.length === 0) {
      const { data, error } = await admin
        .from('gratitudes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      rows = data ?? [];
      source = 'gratitudes';
    }

    // Normalize to a single shape the Admin UI expects.
    type AnyRow = Record<string, any>;
    const items = (rows as AnyRow[])
      .map((r) => {
        const quote =
          r.quote ??
          r.message ??     // from gratitudes
          r.text ??
          r.body ??
          r.content ??
          null;

        return {
          id: r.id,
          created_at: r.created_at,
          quote,
          // rating may not exist on gratitudes — keep nullable
          rating: typeof r.rating === 'number' ? r.rating : null,
          author_id: r.receiver_profile_id ?? r.author_id ?? null,
          subject_id: r.owner_profile_id ?? r.subject_id ?? null,
          offer_id: r.offer_id ?? null,
          request_id: r.request_id ?? null,
          author_name: r.author_name ?? null,
          subject_name: r.subject_name ?? r.subject_title ?? null,
        };
      })
      // only show rows with actual text
      .filter((n) => n.quote && String(n.quote).trim().length > 0);

    // Hydrate names if missing and we have IDs
    const need = items.filter((n) => (n.author_id && !n.author_name) || (n.subject_id && !n.subject_name));
    if (need.length) {
      const ids = Array.from(
        new Set(
          need.flatMap((n) => [n.author_id, n.subject_id].filter(Boolean) as string[])
        )
      );
      if (ids.length) {
        const { data: profs } = await admin
          .from('profiles')
          .select('id,display_name')
          .in('id', ids);
        const map = new Map<string, string>();
        (profs ?? []).forEach((p: any) => map.set(p.id, p.display_name));
        items.forEach((n) => {
          if (n.author_id && !n.author_name) n.author_name = map.get(n.author_id) ?? null;
          if (n.subject_id && !n.subject_name) n.subject_name = map.get(n.subject_id) ?? null;
        });
      }
    }

    return NextResponse.json({ source, items });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message ?? 'Failed to load reviews' }, { status: 500 });
  }
}
