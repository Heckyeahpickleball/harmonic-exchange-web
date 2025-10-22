// @ts-nocheck
// app/admin/delete-user/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !serviceRole) {
  throw new Error('Supabase env vars missing for /admin/delete-user route');
}

const admin = createClient(url, serviceRole, { auth: { persistSession: false } });

/** Errors we should ignore so one missing table/column doesn’t kill the whole delete */
function ignorable(e: any) {
  const code = String(e?.code || '');
  const msg = String(e?.message || '').toLowerCase();
  return (
    code === '42P01' ||               // relation does not exist
    code === '42703' ||               // column does not exist
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||   // supabase-js “schema cache” message
    msg.includes('unknown relation') ||
    (msg.includes('view') && (msg.includes('cannot') || msg.includes('read-only')))
  );
}

/** Delete with a simple equality filter */
async function delEq(table: string, column: string, value: string) {
  try {
    const { error } = await admin.from(table).delete().eq(column, value);
    if (error && !ignorable(error)) throw error;
  } catch (e) {
    if (!ignorable(e)) throw e;
  }
}

/** Delete with an OR filter expression (e.g., "a.eq.X,b.eq.X") */
async function delOr(table: string, orExpr: string) {
  try {
    const { error } = await admin.from(table).delete().or(orExpr);
    if (error && !ignorable(error)) throw error;
  } catch (e) {
    if (!ignorable(e)) throw e;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const id: string = body?.id ?? body?.profile_id ?? body?.user_id ?? body?.uid;
    const reason: string | null = body?.reason ?? null;

    if (!id || typeof id !== 'string' || !id.trim()) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    // --- CHILD ROWS (all best-effort; ignore missing tables/columns) ---

    // Notifications (actor or target)
    await delOr('notifications', `actor_profile_id.eq.${id},target_profile_id.eq.${id}`);

    // Direct/DMs: your schema shows conversation_* & request_messages, not "messages"
    // Try the common possibilities; ignore if the table/columns don’t exist.
    await delOr(
      'conversation_messages',
      `sender_id.eq.${id},recipient_id.eq.${id},author_id.eq.${id},profile_id.eq.${id}`
    );
    await delOr('conversation_reads', `profile_id.eq.${id}`);
    await delOr('conversations', `creator_id.eq.${id},owner_id.eq.${id}`);

    // Request-thread messages (if present)
    await delOr(
      'request_messages',
      `sender_id.eq.${id},recipient_id.eq.${id},author_id.eq.${id},profile_id.eq.${id}`
    );

    // Posts & comments
    await delEq('post_comments', 'author_id', id);
    await delEq('posts', 'author_id', id);

    // Offers / Requests
    await delEq('offers', 'owner_id', id);
    await delOr('requests', `owner_id.eq.${id},provider_id.eq.${id},receiver_id.eq.${id}`);

    // Groups / memberships
    await delEq('group_members', 'profile_id', id);
    await delEq('groups', 'created_by', id);

    // Badges / stats / quotas
    await delEq('profile_badges', 'profile_id', id);
    await delEq('profile_stats', 'profile_id', id);
    await delEq('request_quota_resets', 'profile_id', id);

    // “Reviews” live in GRATITUDES in your schema
    await delOr('gratitudes', `author_id.eq.${id},subject_id.eq.${id},receiver_id.eq.${id}`);

    // If a real `reviews` table exists in some env, try it too (ignore if missing)
    await delOr('reviews', `author_id.eq.${id},subject_id.eq.${id},receiver_id.eq.${id}`);

    // Admin action rows referencing this user
    await delOr('admin_actions', `admin_profile_id.eq.${id},target_id.eq.${id}`);

    // Profile last
    await delEq('profiles', 'id', id);

    // Auth user (ignore if already gone)
    try {
      // @ts-ignore
      await admin.auth.admin.deleteUser(id);
    } catch (e: any) {
      const msg = String(e?.message || '').toLowerCase();
      if (!msg.includes('user not found')) throw e;
    }

    // Best-effort audit
    try {
      await admin.from('admin_actions').insert({
        admin_profile_id: null,
        action: 'profiles.delete',
        target_type: 'profile',
        target_id: id,
        reason,
      });
    } catch {}

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[/admin/delete-user] error:', e);
    const msg = e?.message || e?.error?.message || 'Failed to delete user';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
