// app/api/requests/quota/bulk/route.ts
'use server';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const WINDOW_DAYS = 30;
const STATUSES = ['pending', 'accepted', 'fulfilled'] as const;
const DEFAULT_LIMIT = 3;

function getLimit(): number {
  const raw = process.env.HX_REQUEST_QUOTA_LIMIT;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_LIMIT;
}

// (Optional) gate to admins/moderators only.
// If you don’t have a role column, you can remove this check safely.
async function requireAuth() {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw Object.assign(new Error('not_authenticated'), { status: 401 });
  }
  return user;
}

export async function POST(req: Request) {
  try {
    await requireAuth();

    const body = await req.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body?.profile_ids) ? body.profile_ids : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: 'no_profile_ids' }, { status: 400 });
    }

    const cutoff = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const admin = supabaseAdmin();

    // Use aggregate select to group by requester_profile_id
    const { data, error } = await admin
      .from('requests')
      .select('requester_profile_id, count:id', { head: false })
      .in('requester_profile_id', ids)
      .in('status', STATUSES as unknown as string[])
      .gte('created_at', cutoff);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const usedById: Record<string, number> = {};
    for (const row of data ?? []) {
      // row has shape { requester_profile_id: string, count: number }
      const pid = (row as any).requester_profile_id as string;
      const cnt = Number((row as any).count) || 0;
      usedById[pid] = cnt;
    }

    const limit = getLimit();
    const result = ids.map((profile_id) => ({
      profile_id,
      used: usedById[profile_id] ?? 0,
      limit,
    }));

    return NextResponse.json(result, { status: 200 });
  } catch (e: any) {
    const status = e?.status ?? 500;
    return NextResponse.json({ error: e?.message ?? 'unexpected_error' }, { status });
  }
}
