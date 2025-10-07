'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type MemberRow = {
  profile_id: string;
  role: 'member' | 'moderator' | 'admin' | string | null;
  joined_at: string | null;
  profile: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    area_city: string | null;
    area_country: string | null;
  } | null;
};

export default function ChapterMembersDialog({
  open,
  onClose,
  groupId,
}: {
  open: boolean;
  onClose: () => void;
  groupId: string;
}) {
  const [rows, setRows] = useState<MemberRow[] | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setMsg('');
      setRows(null);
      try {
        // Expecting a join table group_members with profile relation
        const { data, error } = await supabase
          .from('group_members')
          .select('profile_id, role, joined_at, profile:profiles(id,display_name,avatar_url,area_city,area_country)')
          .eq('group_id', groupId)
          .order('joined_at', { ascending: true });

        if (error) throw error;
        if (!cancelled) setRows((data as any) ?? []);
      } catch (e: any) {
        if (!cancelled) setMsg(e?.message ?? 'Failed to load members.');
      }
    })();
    return () => { cancelled = true; };
  }, [open, groupId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-base font-semibold">Members</h3>
          <button onClick={onClose} className="rounded border px-2 py-1 text-sm hover:bg-gray-50" type="button">
            Close
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-3">
          {msg && <p className="text-sm text-amber-700">{msg}</p>}
          {!msg && rows?.length === 0 && <p className="text-sm text-gray-600">No members yet.</p>}

          <ul className="space-y-2">
            {rows?.map((m) => {
              const p = m.profile;
              return (
                <li key={m.profile_id} className="flex items-center justify-between rounded border p-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="h-9 w-9 overflow-hidden rounded-full border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p?.avatar_url || '/images/placeholder-avatar.png'}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="truncate font-medium">{p?.display_name || 'Unnamed'}</div>
                        {m.role && (
                          <span className="rounded-full border px-2 py-0.5 text-[11px] capitalize text-gray-700">
                            {m.role}
                          </span>
                        )}
                      </div>
                      <div className="truncate text-[12px] text-gray-600">
                        {[p?.area_city, p?.area_country].filter(Boolean).join(', ')}
                      </div>
                    </div>
                  </div>

                  <Link
                    href={`/u/${m.profile_id}`}
                    className="hx-btn hx-btn--outline-primary text-xs px-2 py-1 whitespace-nowrap"
                  >
                    View profile
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
