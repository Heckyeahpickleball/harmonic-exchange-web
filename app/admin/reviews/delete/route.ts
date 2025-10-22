// /app/admin/reviews/delete/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs'; // service role requires Node runtime

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!; // server-only

if (!url || !serviceRole) {
  throw new Error('Supabase env vars missing for /admin/reviews/delete route');
}

const admin = createClient(url, serviceRole, { auth: { persistSession: false } });

type DeleteResult = {
  ok: true;
  table: 'reviews' | 'gratitudes';
  count: number;
};

export async function POST(req: Request) {
  try {
    // be resilient to malformed JSON
    const body = (await req.json().catch(() => ({}))) as
      | { id?: string; review_id?: string; gratitude_id?: string; reason?: string | null; actor_id?: string | null }
      | undefined;

    const id =
      body?.id ??
      body?.review_id ??
      body?.gratitude_id;

    if (!id) {
      return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 });
    }

    // Try delete from reviews first
    let deletedFrom: DeleteResult['table'] | null = null;
    let total = 0;

    {
      const { error, count } = await admin
        .from('reviews')
        .delete({ count: 'exact' })
        .eq('id', id);

      if (error) {
        // If the table truly doesn’t exist in some environments, ignore and try next.
        // (Supabase returns a PostgrestError if table missing.)
      } else if ((count ?? 0) > 0) {
        deletedFrom = 'reviews';
        total = count ?? 0;
      }
    }

    // If not found in reviews, try gratitudes
    if (!deletedFrom) {
      const { error, count } = await admin
        .from('gratitudes')
        .delete({ count: 'exact' })
        .eq('id', id);

      if (error) {
        // If both fail, surface this one
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
      if ((count ?? 0) === 0) {
        return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
      }
      deletedFrom = 'gratitudes';
      total = count ?? 0;
    }

    // Best-effort audit (ignore errors)
    try {
      await admin.from('admin_actions').insert({
        action: 'delete_review',
        target_table: deletedFrom,
        target_id: id,
        reason: body?.reason ?? null,
        actor_id: body?.actor_id ?? null,
      });
    } catch {
      // ignore audit errors
    }

    const res: DeleteResult = { ok: true, table: deletedFrom, count: total };
    return NextResponse.json(res);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? 'Unknown error' }, { status: 500 });
  }
}
