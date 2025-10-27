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
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_LIMIT;
}

async function summarizeQuota(profileId: string) {
  const admin = supabaseAdmin();
  const limit = getLimit();
  const cutoff = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { error, count } = await admin
    .from('requests')
    .select('id', { head: true, count: 'exact' })
    .eq('requester_profile_id', profileId)
    .in('status', [...STATUSES])
    .gte('created_at', cutoff);

  if (error) throw error;

  const used = count ?? 0;
  const remaining = Math.max(limit - used, 0);

  return {
    used,
    limit,
    remaining,
    window: WINDOW_LABEL,
  } as const;
}

async function getUserId() {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const quota = await summarizeQuota(userId);
    return NextResponse.json(quota);
  } catch (error) {
    console.error('quota GET failed', error);
    return NextResponse.json({ error: 'Unable to load quota' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const quota = await summarizeQuota(userId);
    if (quota.remaining <= 0) {
      return NextResponse.json(
        {
          error: `You have reached your ask limit (${quota.used} of ${quota.limit}) in the last 30 days.`,
          quota,
        },
        { status: 429 }
      );
    }

    return NextResponse.json({ quota });
  } catch (error) {
    console.error('quota POST failed', error);
    return NextResponse.json({ error: 'Unable to verify quota' }, { status: 500 });
  }
}
