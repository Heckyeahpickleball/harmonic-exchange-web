// app/api/requests/quota/route.ts

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const WINDOW_LABEL = 'last_30_days' as const;
const WINDOW_DAYS = 30;
const STATUSES = ['pending', 'accepted', 'fulfilled'] as const;
const DEFAULT_LIMIT = 3;

function getLimit(): number {
  const raw = process.env.HX_REQUEST_QUOTA_LIMIT;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_LIMIT;
}

export async function GET() {
  try {
    // Identify the current user
    const cookieStore = cookies();
    const client = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
    }

    const profileId = user.id; // profiles.id matches auth user id

    const cutoff = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const admin = supabaseAdmin();

    // Count requests made by this requester in the rolling window
    const { count, error } = await admin
      .from('requests')
      .select('id', { count: 'exact', head: true })
      .eq('requester_profile_id', profileId)
      .in('status', STATUSES as unknown as string[])
      .gte('created_at', cutoff);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const used = count ?? 0;
    const limit = getLimit();

    return NextResponse.json(
      {
        used,
        limit,
        remaining: Math.max(0, limit - used),
        window: WINDOW_LABEL,
      },
      { status: 200 },
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'unexpected_error' }, { status: 500 });
  }
}
