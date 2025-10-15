import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!; // SERVER-ONLY

const admin = createClient(url, serviceRole, { auth: { persistSession: false } });

type AnyRow = Record<string, any>;

export async function GET() {
  try {
    // Prefer the Security-Definer view: public_gratitude_reviews
    let source: 'public_gratitude_reviews' | 'gratitudes' = 'public_gratitude_reviews';
    let rows: AnyRow[] = [];

    {
      const { data, error } = await admin
        .from('public_gratitude_reviews')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(400);

      if (!error && data && data.length) {
        rows = data as AnyRow[];
      }
    }

    // Fallback to raw gratitudes if the view is ever empty
    if (rows.length === 0) {
      const { data, error } = await admin
        .from('gratitudes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(400);
      if (error) throw error;
      rows = (data ?? []) as AnyRow[];
      source = 'gratitudes';
    }

    // Normalize to Admin UI shape
    const items = rows
      .map((r) => {
        // public_gratitude_reviews: message, offer_id, owner_profile_id, receiver_profile_id,
        // receiver_name, owner_name, created_at, id, offer_title, etc.
        // gratitudes fallback: message, offer_id, owner_profile_id, receiver_profile_id, created_at, id
        const quote =
          r.message ??
          r.quote ??
          r.text ??
          r.body ??
          r.content ??
          null;

        return {
          id: r.id,
          created_at: r.created_at,
          quote,
          rating: typeof r.rating === 'number' ? r.rating : null, // nullable (view doesn’t have rating)
          author_id: r.receiver_profile_id ?? r.author_id ?? null,
          subject_id: r.owner_profile_id ?? r.subject_id ?? null,
          offer_id: r.offer_id ?? null,
          request_id: r.request_id ?? null,
          author_name: r.receiver_name ?? r.author_name ?? null,
          subject_name: r.owner_name ?? r.subject_name ?? r.offer_title ?? null,
        };
      })
      .filter((n) => n.quote && String(n.quote).trim().length > 0)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Enrich names only if missing and we have ids
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

    return NextResponse.json({ source, items });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message ?? 'Failed to load reviews' }, { status: 500 });
  }
}
