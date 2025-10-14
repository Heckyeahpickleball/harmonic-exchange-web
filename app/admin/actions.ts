// app/admin/actions.ts
'use server';

import { revalidatePath } from 'next/cache';

export async function deleteUserAction(userId: string, reason: string | null) {
  if (!userId) return false;
  const secret = process.env.HX_ADMIN_SECRET;
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  if (!secret) {
    console.error('HX_ADMIN_SECRET missing');
    return false;
  }
  try {
    const res = await fetch(`${site}/admin/delete-user`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-hx-admin': secret,
      } as any,
      body: JSON.stringify({ user_id: userId, reason }),
      cache: 'no-store',
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error('Delete failed', res.status, txt);
      return false;
    }
    revalidatePath('/admin');
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}
