'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Profile = {
  id: string
  display_name: string
  role: string
  status: string
  area_city: string | null
  area_country: string | null
  created_at: string
}

type Offer = {
  id: string
  owner_id: string
  title: string
  status: string
  city: string | null
  country: string | null
  is_online: boolean
  created_at: string
}

type Audit = {
  id: string
  admin_profile_id: string
  action: string
  target_type: string
  target_id: string
  reason: string | null
  created_at: string
}

type Tab = 'users' | 'offers' | 'audit'

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('users')
  const [meIsAdmin, setMeIsAdmin] = useState<boolean>(false)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')

  const [users, setUsers] = useState<Profile[]>([])
  const [offers, setOffers] = useState<Offer[]>([])
  const [audits, setAudits] = useState<Audit[]>([])

  useEffect(() => {
    (async () => {
      setLoading(true)

      // Require login
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.replace('/sign-in')
        return
      }

      // Check admin
      const { data: isAdmin, error: adminErr } = await supabase.rpc('is_admin')
      if (adminErr || !isAdmin) {
        setMeIsAdmin(false)
        setLoading(false)
        setStatus('You are not authorized to view this page.')
        return
      }
      setMeIsAdmin(true)

      // Load data
      await Promise.all([loadUsers(), loadOffers(), loadAudit()])
      setLoading(false)
    })()
  }, [])

  async function loadUsers() {
    const { data } = await supabase
      .from('profiles')
      .select('id,display_name,role,status,area_city,area_country,created_at')
      .order('created_at', { ascending: false })
      .limit(100)
    setUsers((data ?? []) as Profile[])
  }

  async function loadOffers() {
    const { data } = await supabase
      .from('offers')
      .select('id,owner_id,title,status,city,country,is_online,created_at')
      .order('created_at', { ascending: false })
      .limit(100)
    setOffers((data ?? []) as Offer[])
  }

  async function loadAudit() {
    const { data } = await supabase
      .from('admin_actions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    setAudits((data ?? []) as Audit[])
  }

  // ---------- actions ----------
  async function suspendUser(id: string) {
    setStatus('Suspending…')
    const { error } = await supabase.rpc('admin_user_set_status', {
      p_profile_id: id,
      p_status: 'suspended',
      p_reason: 'Manual action',
    })
    if (error) setStatus(`Error: ${error.message}`)
    else {
      await loadUsers()
      await loadAudit()
      setStatus('User suspended.')
    }
  }

  async function unsuspendUser(id: string) {
    setStatus('Unsuspending…')
    const { error } = await supabase.rpc('admin_user_set_status', {
      p_profile_id: id,
      p_status: 'active',
      p_reason: 'Manual action',
    })
    if (error) setStatus(`Error: ${error.message}`)
    else {
      await loadUsers()
      await loadAudit()
      setStatus('User active.')
    }
  }

  async function blockOffer(id: string) {
    setStatus('Blocking offer…')
    const { error } = await supabase.rpc('admin_offer_set_status', {
      p_offer_id: id,
      p_status: 'blocked',
      p_reason: 'Manual action',
    })
    if (error) setStatus(`Error: ${error.message}`)
    else {
      await loadOffers()
      await loadAudit()
      setStatus('Offer blocked.')
    }
  }

  async function unblockOffer(id: string) {
    setStatus('Unblocking offer…')
    const { error } = await supabase.rpc('admin_offer_set_status', {
      p_offer_id: id,
      p_status: 'active',
      p_reason: 'Manual action',
    })
    if (error) setStatus(`Error: ${error.message}`)
    else {
      await loadOffers()
      await loadAudit()
      setStatus('Offer active.')
    }
  }

  if (loading) return <p>Loading…</p>
  if (!meIsAdmin) return <p className="text-sm text-red-700">{status || 'Not authorized.'}</p>

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold">Admin</h2>

      <div className="flex gap-3 text-sm">
        <button className={`underline ${tab==='users'?'font-semibold':''}`} onClick={() => setTab('users')}>Users</button>
        <button className={`underline ${tab==='offers'?'font-semibold':''}`} onClick={() => setTab('offers')}>Offers</button>
        <button className={`underline ${tab==='audit'?'font-semibold':''}`} onClick={() => setTab('audit')}>Audit</button>
      </div>

      {status && <p className="text-sm">{status}</p>}

      {tab === 'users' && (
        <div className="overflow-auto rounded border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-left">Role</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Location</th>
                <th className="p-2 text-left">Joined</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-t">
                  <td className="p-2">{u.display_name}</td>
                  <td className="p-2">{u.role}</td>
                  <td className="p-2">{u.status}</td>
                  <td className="p-2">{[u.area_city, u.area_country].filter(Boolean).join(', ')}</td>
                  <td className="p-2">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="p-2 text-center">
                    {u.status !== 'suspended' ? (
                      <button onClick={() => suspendUser(u.id)} className="rounded border px-2 py-1">Suspend</button>
                    ) : (
                      <button onClick={() => unsuspendUser(u.id)} className="rounded border px-2 py-1">Unsuspend</button>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td className="p-3 text-center text-gray-500" colSpan={6}>No users</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'offers' && (
        <div className="overflow-auto rounded border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-2 text-left">Title</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Location</th>
                <th className="p-2 text-left">Owner ID</th>
                <th className="p-2 text-left">Created</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {offers.map(o => (
                <tr key={o.id} className="border-t">
                  <td className="p-2">{o.title}</td>
                  <td className="p-2">{o.status}</td>
                  <td className="p-2">
                    {o.is_online ? 'Online' : [o.city, o.country].filter(Boolean).join(', ')}
                  </td>
                  <td className="p-2">{o.owner_id.slice(0, 8)}…</td>
                  <td className="p-2">{new Date(o.created_at).toLocaleDateString()}</td>
                  <td className="p-2 text-center">
                    {o.status !== 'blocked' ? (
                      <button onClick={() => blockOffer(o.id)} className="rounded border px-2 py-1">Block</button>
                    ) : (
                      <button onClick={() => unblockOffer(o.id)} className="rounded border px-2 py-1">Unblock</button>
                    )}
                  </td>
                </tr>
              ))}
              {offers.length === 0 && (
                <tr><td className="p-3 text-center text-gray-500" colSpan={6}>No offers</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'audit' && (
        <div className="overflow-auto rounded border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-2 text-left">When</th>
                <th className="p-2 text-left">Admin</th>
                <th className="p-2 text-left">Action</th>
                <th className="p-2 text-left">Target</th>
                <th className="p-2 text-left">Reason</th>
              </tr>
            </thead>
            <tbody>
              {audits.map(a => (
                <tr key={a.id} className="border-t">
                  <td className="p-2">{new Date(a.created_at).toLocaleString()}</td>
                  <td className="p-2">{a.admin_profile_id.slice(0,8)}…</td>
                  <td className="p-2">{a.action}</td>
                  <td className="p-2">{a.target_type}:{' '}{a.target_id.slice(0,8)}…</td>
                  <td className="p-2">{a.reason ?? ''}</td>
                </tr>
              ))}
              {audits.length === 0 && (
                <tr><td className="p-3 text-center text-gray-500" colSpan={5}>No audit entries</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
