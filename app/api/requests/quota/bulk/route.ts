import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const WINDOW_DAYS = 30;
const STATUSES = ['pending', 'accepted', 'fulfilled'] as const;
const DEFAULT_LIMIT = 3;

type Role = 'user' | 'moderator' | 'admin';

type BulkPayload = {
  profile_ids?: unknown;
};

type BulkResult = {
  profile_id: string;
  used: number;
  limit: number;
};

function getLimit(): number {
  const raw = process.env.HX_REQUEST_QUOTA_LIMIT;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_LIMIT;
}

export async function POST(req: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    const role = (profile?.role as Role | undefined) ?? 'user';
    if (role !== 'admin' && role !== 'moderator') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const payload = (await req.json().catch(() => null)) as BulkPayload | null;
    const idsInput = Array.isArray(payload?.profile_ids) ? payload!.profile_ids : [];
    const ids = Array.from(
      new Set(
        (idsInput as unknown[]).filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      )
    );

    const limit = getLimit();

    if (ids.length === 0) {
      return NextResponse.json([] satisfies BulkResult[]);
    }

    const cutoff = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from('requests')
      .select('requester_profile_id, count:id', { head: false })
      .in('requester_profile_id', ids)
      .in('status', [...STATUSES])
      .gte('created_at', cutoff)
      .group('requester_profile_id');

    if (error) throw error;

    const counts = new Map<string, number>();
    for (const row of (data || []) as Array<{ requester_profile_id: string; count: string | number }>) {
      counts.set(row.requester_profile_id, Number(row.count) || 0);
    }

    const results: BulkResult[] = ids.map((id) => ({
      profile_id: id,
      used: counts.get(id) ?? 0,
      limit,
    }));

    return NextResponse.json(results);
  } catch (error) {
    console.error('quota bulk error', error);
    return NextResponse.json({ error: 'Unable to load quotas' }, { status: 500 });
  }
}
