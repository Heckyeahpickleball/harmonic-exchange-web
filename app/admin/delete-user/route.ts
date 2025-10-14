// /app/admin/reviews/delete/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!; // server-only

const admin = createClient(url, serviceRole, { auth: { persistSession: false } });

export async function POST(req: Request) {
  try {
    const { id, reason } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    // 1) Try 'reviews'
    let deleted = 0;
    {
      const { data, error, count } = await admin
        .from('reviews')
        .delete({ count: 'exact' })
        .eq('id', id);

      if (!error) deleted = (count ?? 0);
      else if (!/relation "reviews" does not exist/i.test(error.message)) {
        // If the table exists and failed for other reasons, surface it
        throw error;
      }
    }

    // 2) Try 'review_gratitudes' if not deleted
    if (!deleted) {
      const { data, error, count } = await admin
        .from('review_gratitudes')
        .delete({ count: 'exact' })
        .eq('id', id);

      if (!error) deleted = (count ?? 0);
      else if (!/relation "review_gratitudes" does not exist/i.test(error.message)) {
        throw error;
      }
    }

    // 3) Try 'gratitudes' if still not deleted
    if (!deleted) {
      const { data, error, count } = await admin
        .from('gratitudes')
        .delete({ count: 'exact' })
        .eq('id', id);

      if (!error) deleted = (count ?? 0);
      else throw error;
    }

    if (!deleted) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    // Best-effort audit log
    try {
      await admin.from('admin_actions').insert({
        admin_profile_id: null, // could decode JWT and look up admin if desired
        action: 'reviews.delete',
        target_type: 'review',
        target_id: id,
        reason: reason ?? null,
      });
    } catch { /* ignore */ }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message ?? 'Failed to delete review' }, { status: 500 });
  }
}
