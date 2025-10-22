// app/admin/AdminUsers.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { deleteUserAction } from './actions';

type Role = 'user' | 'moderator' | 'admin';
type Status = 'active' | 'blocked' | 'suspended' | string;

type ProfileRow = {
  id: string;
  email: string | null;
  role: Role;
  status: Status;
  created_at: string;
  display_name: string | null;
};

export default function AdminUsers() {
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState('');
  const [loadError, setLoadError] = useState<string>('');

  // Operation banners (role change / delete)
  const [opError, setOpError] = useState<string>('');
  const [opNotice, setOpNotice] = useState<string>('');

  const [myId, setMyId] = useState<string | null>(null);

  const [draft, setDraft] = useState<Record<string, Role>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});

  // who am I?
  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!cancel) setMyId(data?.user?.id ?? null);
    })();
    return () => {
      cancel = true;
    };
  }, []);

  // load users
  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      setLoadError('');
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, email, role, status, created_at, display_name')
          .order('created_at', { ascending: false })
          .limit(500);
        if (error) throw error;
        if (!cancel) setRows((data || []) as ProfileRow[]);
      } catch (e: any) {
        if (!cancel) setLoadError(e?.message ?? 'Failed to load users.');
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        (r.display_name || '').toLowerCase().includes(s) ||
        (r.email || '').toLowerCase().includes(s) ||
        (r.role || '').toLowerCase().includes(s)
    );
  }, [q, rows]);

  function setDraftRole(userId: string, nextRole: Role) {
    setDraft((d) => ({ ...d, [userId]: nextRole }));
  }

  // --- helper: gather nested error messages from our /admin/set-role route
  function flattenErrorMessages(obj: any): string[] {
    const msgs: string[] = [];
    const push = (v: any) => {
      if (!v) return;
      if (typeof v === 'string') msgs.push(v);
    };

    try {
      push(obj?.error);
      push(obj?.message);
      push(obj?.details);
      push(obj?.hint);
      if (obj?.code) push(`code:${obj.code}`);

      // nested rpc/direct blocks (from our route)
      if (obj?.rpc) {
        push(obj.rpc.message);
        push(obj.rpc.details);
        push(obj.rpc.hint);
        if (obj.rpc.code) push(`rpc:${obj.rpc.code}`);
      }
      if (obj?.direct) {
        push(obj.direct.message);
        push(obj.direct.details);
        push(obj.direct.hint);
        if (obj.direct.code) push(`direct:${obj.direct.code}`);
      }
    } catch {
      // ignore
    }
    // dedupe & trim
    return Array.from(new Set(msgs.map((m) => String(m).trim()).filter(Boolean)));
  }

  async function setUserRole(profileId: string, role: Role, reason?: string) {
    const { data: sess } = await supabase.auth.getSession();
    const accessToken = sess?.session?.access_token;
    if (!accessToken) throw new Error('Not signed in');

    const res = await fetch('/admin/set-role', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ profile_id: profileId, role, reason }),
    });

    // Guard in case response isn't JSON
    let json: any = {};
    try {
      json = await res.json();
    } catch {
      /* ignore */
    }

    if (!res.ok) {
      const parts = flattenErrorMessages(json);
      throw new Error(parts.join(' — ') || `HTTP ${res.status}`);
    }
    return json;
  }

  async function onApplyRole(u: ProfileRow) {
    setOpError('');
    setOpNotice('');
    const targetRole: Role = draft[u.id] ?? u.role;
    if (targetRole === u.role) {
      setOpNotice('No change to apply.');
      return;
    }
    if (u.id === myId) {
      setOpError("You can't change your own role.");
      return;
    }

    const reason = prompt('Optional reason for audit log:') || undefined;

    try {
      setPending((p) => ({ ...p, [u.id]: true }));
      await setUserRole(u.id, targetRole, reason);

      // success: update UI
      setRows((prev) => prev.map((r) => (r.id === u.id ? { ...r, role: targetRole } as ProfileRow : r)));
      setDraft((d) => {
        const { [u.id]: _, ...rest } = d;
        return rest;
      });
      setOpNotice(`Role updated to "${targetRole}".`);
    } catch (e: any) {
      setOpError(e?.message ?? 'Role update failed.');
      // also log full object to devtools to aid debugging
      // eslint-disable-next-line no-console
      console.error('setUserRole error payload:', e);
    } finally {
      setPending((p) => ({ ...p, [u.id]: false }));
    }
  }

  async function onDelete(userId: string) {
    setOpError('');
    setOpNotice('');
const reason = prompt('Delete user — optional reason (for audit):') || null;
if (!(await confirm('Delete this user?\n\nThis is a permanent admin action and cannot be undone.'))) return;
    try {
      const ok = await deleteUserAction(userId, reason);
      if (ok) {
        setRows((prev) => prev.filter((r) => r.id !== userId));
        setOpNotice('User deleted.');
      } else {
        setOpError('Deletion failed.');
      }
    } catch (e: any) {
      setOpError(e?.message ?? 'Deletion failed.');
    }
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        {loadError ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {loadError}
          </div>
        ) : (
          <div className="text-sm text-gray-600">{loading ? 'Loading…' : `${rows.length} members`}</div>
        )}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, email, role…"
          className="w-64 rounded-lg border px-3 py-2 text-sm"
        />
      </div>

      {/* operation banners */}
      {opError && (
        <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {opError}
        </div>
      )}
      {opNotice && !opError && (
        <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {opNotice}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Joined</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const current = u.role;
              const draftValue = draft[u.id] ?? current;
              const isSelf = u.id === myId;
              const isBusy = !!pending[u.id];

              return (
                <tr key={u.id} className="border-t">
                  <td className="px-3 py-2">{u.display_name || '—'}</td>
                  <td className="px-3 py-2">{u.email || '—'}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <select
                        value={draftValue}
                        onChange={(e) => setDraftRole(u.id, e.target.value as Role)}
                        className="rounded-md border px-2 py-1"
                        disabled={isSelf || isBusy}
                        title={isSelf ? "You can't change your own role" : 'Select role'}
                      >
                        <option value="user">user</option>
                        <option value="moderator">moderator</option>
                        <option value="admin">admin</option>
                      </select>
                      {draftValue !== current && <span className="text-xs text-amber-600">unsaved</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2">{u.status}</td>
                  <td className="px-3 py-2">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => onApplyRole(u)}
                        disabled={isSelf || isBusy || draftValue === current}
                        className={`rounded border px-2 py-1 hover:bg-gray-50 ${
                          isBusy ? 'cursor-wait opacity-70' : isSelf || draftValue === current ? 'opacity-50' : ''
                        }`}
                        title={isSelf ? "You can't change your own role" : 'Apply selected role'}
                      >
                        {isBusy ? 'Saving…' : 'Update role'}
                      </button>
                      <button
                        onClick={() => onDelete(u.id)}
                        className="rounded border border-rose-300 px-2 py-1 text-rose-700 hover:bg-rose-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!loading && filtered.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-gray-500" colSpan={6}>
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
