// /app/profile/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type FormState = {
  display_name: string
  area_city: string
  area_country: string
  skillsCSV: string   // comma-separated, we’ll store as text[]
  bio: string
}

export default function ProfilePage() {
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<string>('')

  const [form, setForm] = useState<FormState>({
    display_name: '',
    area_city: '',
    area_country: '',
    skillsCSV: '',
    bio: '',
  })

  // Load current user + profile
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setStatus('')

      const { data: userRes, error: userErr } = await supabase.auth.getUser()
      if (userErr || !userRes.user) {
        setLoading(false)
        return
      }
      const u = userRes.user
      if (cancelled) return
      setUserEmail(u.email ?? u.phone ?? null)
      setUserId(u.id)

      // Fetch profile row
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('display_name, area_city, area_country, skills, bio')
        .eq('id', u.id)
        .single()

      if (profErr) {
        // If this ever happens, it usually means the profile row hasn't been created yet.
        // Easiest fix: Sign out, sign back in (our DB trigger auto-creates the row).
        setStatus(`Heads up: profile not found yet. Try Sign Out then Sign In again to create it. (${profErr.message})`)
        setLoading(false)
        return
      }

      setForm({
        display_name: prof.display_name ?? '',
        area_city: prof.area_city ?? '',
        area_country: prof.area_country ?? '',
        skillsCSV: Array.isArray(prof.skills) ? prof.skills.join(', ') : '',
        bio: prof.bio ?? '',
      })

      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  async function onSave(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) return

    const display_name = form.display_name.trim()
    if (!display_name) {
      setStatus('Display name is required.')
      return
    }

    const skills = form.skillsCSV
      .split(',')
      .map(s => s.trim())
      .filter(Boolean) // remove empties

    setSaving(true)
    setStatus('Saving...')

    const { error } = await supabase
      .from('profiles')
      .update({
        display_name,
        area_city: form.area_city.trim() || null,
        area_country: form.area_country.trim() || null,
        bio: form.bio.trim() || null,
        skills, // stores as text[]
      })
      .eq('id', userId)

    setSaving(false)

    if (error) {
      setStatus(`Save failed: ${error.message}`)
    } else {
      setStatus('Saved! ✅')
    }
  }

  if (loading) return <p className="p-4">Loading...</p>

  if (!userEmail) {
    return (
      <section className="max-w-lg space-y-4 p-4">
        <h2 className="text-2xl font-bold">My Profile</h2>
        <p>You are not signed in.</p>
        <a className="underline" href="/sign-in">Go to Sign In</a>
      </section>
    )
  }

  return (
    <section className="max-w-xl space-y-4 p-4">
      <h2 className="text-2xl font-bold">My Profile</h2>
      <p className="text-sm text-gray-700">Signed in as <strong>{userEmail}</strong></p>

      <form onSubmit={onSave} className="space-y-3">
        <div>
          <label className="block text-sm font-medium">Display name *</label>
          <input
            className="mt-1 w-full rounded border p-2"
            value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            placeholder="e.g., Sara W."
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">City</label>
            <input
              className="mt-1 w-full rounded border p-2"
              value={form.area_city}
              onChange={(e) => setForm({ ...form, area_city: e.target.value })}
              placeholder="Ottawa"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Country</label>
            <input
              className="mt-1 w-full rounded border p-2"
              value={form.area_country}
              onChange={(e) => setForm({ ...form, area_country: e.target.value })}
              placeholder="Canada"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">Skills (comma-separated)</label>
          <input
            className="mt-1 w-full rounded border p-2"
            value={form.skillsCSV}
            onChange={(e) => setForm({ ...form, skillsCSV: e.target.value })}
            placeholder="healing, design, tutoring"
          />
          <p className="mt-1 text-xs text-gray-500">Example: <code>coaching, event planning, web design</code></p>
        </div>

        <div>
          <label className="block text-sm font-medium">Short bio</label>
          <textarea
            className="mt-1 w-full rounded border p-2"
            rows={5}
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            placeholder="What you care about and want to gift to the community..."
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
          <button
            type="button"
            onClick={() => location.reload()}
            className="rounded border px-4 py-2"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={async () => { await supabase.auth.signOut(); location.href='/' }}
            className="ml-auto rounded border px-4 py-2"
          >
            Sign Out
          </button>
        </div>
      </form>

      {status && <p className="text-sm text-gray-700">{status}</p>}
    </section>
  )
}
