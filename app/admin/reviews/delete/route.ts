// /app/admin/reviews/delete/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!; // server-only

if (!url || !serviceRole) {
  throw new Error('Supabase env vars missing for /admin/reviews/delete route');
}

const admin = createClient(url, serviceRole, { auth: { persistSession: false } });

type DeleteResult =
  | { ok: true; table: 'gratitudes' | 'reviews'; count: number }
  | { error: string };

export async function POST(req: Request) {
  try {
    // Accept several possible keys coming from the UI
    const body = await req.json().catch(() => ({} as any));
    const id: string | undefined =
      body?.id ??
      body?.review_id ??
      body?.gratitude_id ??
      body?.reviewId ??
      body?.gratitudeId;

    const reason: string | null = body?.reason ?? null;

    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    // Helper that "tries" a delete but swallows missing-table / view errors
    async function tryDelete(table: 'gratitudes' | 'reviews') {
      try {
        const { error, count } = await admin.from(table).delete({ count: 'exact' }).eq('id', id);
        if (error) {
          const msg = (error.message || '').toLowerCase();
          // ignore “relation does not exist” (42P01) and view write errors
          if (
            error.code === '42P01' ||
            msg.includes('does not exist') ||
            (msg.includes('view') && (msg.includes('cannot') || msg.includes('read-only')))
          ) {
            return { table, count: 0 as number, ignored: true } as const;
          }
          throw error;
        }
        return { table, count: count ?? 0, ignored: false } as const;
      } catch (e: any) {
        const msg = (e?.message || '').toLowerCase();
        if (
          (e?.code === '42P01') ||
          msg.includes('does not exist') ||
          (msg.includes('view') && (msg.includes('cannot') || msg.includes('read-only')))
        ) {
          return { table, count: 0 as number, ignored: true } as const;
        }
        throw e;
      }
    }

    // Our schema uses GRATITUDES as the writable base table for “reviews”.
    // Try that first. If some env also has a real `reviews` table, try it second.
    const fromGratitudes = await tryDelete('gratitudes');
    if (fromGratitudes.count > 0) {
      // audit (best-effort)
      try {
        await admin.from('admin_actions').insert({
          admin_profile_id: null,
          action: 'reviews.delete',
          target_type: 'review',
          target_id: id,
          reason,
          meta: { table: 'gratitudes', count: fromGratitudes.count },
        });
      } catch {}
      return NextResponse.json({ ok: true, table: 'gratitudes', count: fromGratitudes.count } satisfies DeleteResult);
    }

    // Optional: if a real `reviews` table exists in some deployments
    const fromReviews = await tryDelete('reviews');
    if (fromReviews.count > 0) {
      try {
        await admin.from('admin_actions').insert({
          admin_profile_id: null,
          action: 'reviews.delete',
          target_type: 'review',
          target_id: id,
          reason,
          meta: { table: 'reviews', count: fromReviews.count },
        });
      } catch {}
      return NextResponse.json({ ok: true, table: 'reviews', count: fromReviews.count } satisfies DeleteResult);
    }

    // Nothing deleted (and we intentionally never try views like reviews_public/reviews_public_mv)
    return NextResponse.json({ error: 'Review not found' }, { status: 404 });
  } catch (e: any) {
    console.error('[admin/reviews/delete] error:', e);
    const msg = e?.message || 'Failed to delete review';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
