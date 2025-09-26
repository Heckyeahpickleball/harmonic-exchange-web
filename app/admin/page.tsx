// File: app/admin/page.tsx
'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';

type Tab = 'users' | 'offers' | 'requests' | 'audit';

type ProfileRow = {
  id: string;
  display_name: string | null;
  role: 'user' | 'admin' | 'moderator';
  status: 'active' | 'suspended';
  created_at: string;
};

type OfferRow = {
  id: string;
  title: string;
  status: 'active' | 'paused' | 'archived' | 'blocked';
  owner_id: string;
  created_at: string;
  owner_name?: string | null;
};

type RequestRow = {
  id: string;
  status: 'pending' | 'accepted' | 'declined' | 'withdrawn' | 'fulfilled';
  created_at: string;
  offer_id: string;
  requester_profile_id: string;
  offer_title?: string | null;
  requester_name?: string | null;
};

type AuditRow = {
  id: string;
  admin_profile_id: string;
  action: string;
  target_type: string;
  target_id: string;
  reason: string | null;
  created_at: string;
  admin_name?: string | null;
};

export const dynamic = 'force-dynamic';

export default function AdminPage() {
  const [me, setMe] = useState<{ id: string; role: string; name: string | null } | null>(null);
  const [tab, setTab] = useState<Tab>('users');
  const [msg, setMsg] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);

  // load current user + role
  useEffect(() => {
    void (async () => {
      setLoading(true);
      setMsg('');
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id ?? null;
      if (!uid) {
        setMe(null);
        setLoading(false);
        return;
      }
      const { data: prof } = await supabase
        .from('profiles')
        .select('id, role, display_name')
        .eq('id', uid)
        .single();
      setMe({ id: uid, role: (prof?.role ?? 'user') as string, name: prof?.display_name ?? null });
      setLoading(false);
    })();
  }, []);

  const isAdmin = useMemo(
    () => !!me && (me.role === 'admin' || me.role === 'moderator'),
    [me]
  );

  // loaders
  const loadUsers = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, role, status, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    setUsers((data || []) as ProfileRow[]);
  }, []);

  const loadOffers = useCallback(async () => {
    const { data, error } = await supabase
      .from('offers')
      .select('id, title, status, owner_id, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;

    const rows = (data || []) as OfferRow[];
    const ownerIds = Array.from(new Set(rows.map(r => r.owner_id)));
    if (ownerIds.length) {
      const { data: owners } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', ownerIds);
      const map = new Map<string, string | null>();
      for (const o of (owners || []) as any[]) map.set(o.id, o.display_name ?? null);
      setOffers(rows.map(r => ({ ...r, owner_name: map.get(r.owner_id) ?? null })));
    } else {
      setOffers(rows);
    }
  }, []);

  const loadRequests = useCallback(async () => {
    const { data, error } = await supabase
      .from('requests')
      .select(`
        id, status, created_at, offer_id, requester_profile_id,
        offers ( id, title ),
        requester:profiles ( id, display_name )
      `)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;

    const rows: RequestRow[] = (data || []).map((r: any) => ({
      id: r.id,
      status: r.status,
      created_at: r.created_at,
      offer_id: r.offer_id,
      requester_profile_id: r.requester_profile_id,
      offer_title: r.offers?.title ?? null,
      requester_name: r.requester?.display_name ?? null,
    }));

    setRequests(rows);
  }, []);

  const loadAudit = useCallback(async () => {
    const { data, error } = await supabase
      .from('admin_actions')
      .select('id, admin_profile_id, action, target_type, target_id, reason, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;

    const rows = (data || []) as AuditRow[];
    const adminIds = Array.from(new Set(rows.map(r => r.admin_profile_id)));
    if (adminIds.length) {
      const { data: admins } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', adminIds);
      const map = new Map<string, string | null>();
      for (const a of (admins || []) as any[]) map.set(a.id, a.display_name ?? null);
      setAudit(rows.map(r => ({ ...r, admin_name: map.get(r.admin_profile_id) ?? null })));
    } else {
      setAudit(rows);
    }
  }, []);

  const loadTab = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setMsg('');
    try {
      if (tab === 'users') await loadUsers();
      if (tab === 'offers') await loadOffers();
      if (tab === 'requests') await loadRequests();
      if (tab === 'audit') await loadAudit();
    } catch (e: any) {
      setMsg(e?.message ?? 'Failed to load admin data.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, tab, loadUsers, loadOffers, loadRequests, loadAudit]);

  useEffect(() => {
    void loadTab();
  }, [loadTab]);

  // actions
  async function logAction(action: string, target_type: string, target_id: string, reason?: string) {
    await supabase.from('admin_actions').insert({
      action, target_type, target_id, reason: reason ?? null,
      admin_profile_id: me?.id,
    });
  }

  async function setUserStatus(p: ProfileRow, next: 'active'|'suspended') {
    setMsg('');
    // optimistic
    setUsers(prev => prev.map(u => u.id === p.id ? { ...u, status: next } : u));
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: next })
        .eq('id', p.id);
      if (error) throw error;
      await logAction(next === 'suspended' ? 'suspend_user' : 'unsuspend_user', 'profile', p.id);
    } catch (e: any) {
      setMsg(e?.message ?? 'Update failed.');
      // revert
      setUsers(prev => prev.map(u => u.id === p.id ? { ...u, status: p.status } : u));
    }
  }

  async function setOfferStatus(o: OfferRow, next: OfferRow['status']) {
    setMsg('');
    const prev = o.status;
    setOffers(prevRows => prevRows.map(x => x.id === o.id ? ({ ...x, status: next }) : x));
    try {
      const { error } = await supabase
        .from('offers')
        .update({ status: next })
        .eq('id', o.id);
      if (error) throw error;
      await logAction(next === 'blocked' ? 'block_offer' : 'unblock_offer', 'offer', o.id);
    } catch (e: any) {
      setMsg(e?.message ?? 'Update failed.');
      setOffers(prevRows => prevRows.map(x => x.id === o.id ? ({ ...x, status: prev }) : x));
    }
  }

  if (loading && !me) {
    return <div className="p-4 text-sm text-gray-600">Loading…</div>;
  }

  if (!isAdmin) {
    return (
      <div className="max-w-3xl">
        <h1 className="mb-2 text-2xl font-bold">Admin</h1>
        <p className="text-sm text-gray-600">
          You don’t have access to the Admin panel. If this is a mistake, please contact an admin.
        </p>
      </div>
    );
  }

  return (
    <section className="max-w-6xl">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <div className="flex gap-2">
          {(['users','offers','requests','audit'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded border px-3 py-1 text-sm ${tab === t ? 'bg-gray-900 text-white' : 'hover:bg-gray-50'}`}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {msg && <p className="mb-3 text-sm text-amber-700">{msg}</p>}
      {loading && <p className="mb-3 text-sm text-gray-600">Loading…</p>}

      {/* USERS */}
      {tab === 'users' && (
        <div className="overflow-x-auto rounded border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Joined</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-t">
                  <td className="px-3 py-2">{u.display_name || u.id.slice(0,8)}</td>
                  <td className="px-3 py-2">{u.role}</td>
                  <td className="px-3 py-2">{u.status}</td>
                  <td className="px-3 py-2">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-3 py-2">
                    {u.status === 'active' ? (
                      <button
                        onClick={() => void setUserStatus(u, 'suspended')}
                        className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
                      >
                        Suspend
                      </button>
                    ) : (
                      <button
                        onClick={() => void setUserStatus(u, 'active')}
                        className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
                      >
                        Unsuspend
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td className="px-3 py-3 text-gray-600" colSpan={5}>No users.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* OFFERS */}
      {tab === 'offers' && (
        <div className="overflow-x-auto rounded border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Owner</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {offers.map(o => (
                <tr key={o.id} className="border-t">
                  <td className="px-3 py-2">
                    <Link className="underline" href={`/offers/${o.id}`}>{o.title}</Link>
                  </td>
                  <td className="px-3 py-2">{o.owner_name || o.owner_id.slice(0,8)}</td>
                  <td className="px-3 py-2">{o.status}</td>
                  <td className="px-3 py-2">{new Date(o.created_at).toLocaleDateString()}</td>
                  <td className="px-3 py-2 flex gap-2">
                    {o.status === 'blocked' ? (
                      <button
                        onClick={() => void setOfferStatus(o, 'active')}
                        className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
                      >
                        Unblock
                      </button>
                    ) : (
                      <button
                        onClick={() => void setOfferStatus(o, 'blocked')}
                        className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
                      >
                        Block
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {offers.length === 0 && (
                <tr><td className="px-3 py-3 text-gray-600" colSpan={5}>No offers.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* REQUESTS (read-only here; owners moderate in Exchanges) */}
      {tab === 'requests' && (
        <div className="overflow-x-auto rounded border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-3 py-2">Offer</th>
                <th className="px-3 py-2">Requester</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(r => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">
                    <Link className="underline" href={`/offers/${r.offer_id}`}>
                      {r.offer_title || r.offer_id.slice(0,8)}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{r.requester_name || r.requester_profile_id.slice(0,8)}</td>
                  <td className="px-3 py-2">{r.status}</td>
                  <td className="px-3 py-2">{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {requests.length === 0 && (
                <tr><td className="px-3 py-3 text-gray-600" colSpan={4}>No requests.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* AUDIT */}
      {tab === 'audit' && (
        <div className="overflow-x-auto rounded border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Admin</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Target</th>
                <th className="px-3 py-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {audit.map(a => (
                <tr key={a.id} className="border-t">
                  <td className="px-3 py-2">{new Date(a.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2">{a.admin_name || a.admin_profile_id.slice(0,8)}</td>
                  <td className="px-3 py-2">{a.action}</td>
                  <td className="px-3 py-2">{a.target_type}:{' '}{a.target_id.slice(0,8)}</td>
                  <td className="px-3 py-2">{a.reason || ''}</td>
                </tr>
              ))}
              {audit.length === 0 && (
                <tr><td className="px-3 py-3 text-gray-600" colSpan={5}>No audit entries.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
