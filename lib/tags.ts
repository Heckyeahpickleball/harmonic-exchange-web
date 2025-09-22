// /lib/tags.ts
import { supabase } from '@/lib/supabaseClient'

export type Tag = { id: number; name: string }

/** Read all tags for pickers/filters (sorted by name). */
export async function fetchAllTags(): Promise<Tag[]> {
  const { data, error } = await supabase.from('tags').select('id,name').order('name')
  if (error) throw error
  return (data ?? []) as Tag[]
}

/** Ensure a set of tag *names* exist, returning the Tag rows (existing + newly created). */
export async function ensureTagsExist(names: string[]): Promise<Tag[]> {
  const uniq = Array.from(new Set(names.map(n => n.trim()).filter(Boolean)))
  if (uniq.length === 0) return []

  // Which already exist?
  const { data: existing, error: selErr } = await supabase
    .from('tags')
    .select('id,name')
    .in('name', uniq)
  if (selErr) throw selErr

  const existingNames = new Set((existing ?? []).map(t => (t as Tag).name.toLowerCase()))
  const toCreate = uniq.filter(n => !existingNames.has(n.toLowerCase()))

  let created: Tag[] = []
  if (toCreate.length) {
    const { data: inserted, error: insErr } = await supabase
      .from('tags')
      .insert(toCreate.map(name => ({ name })))
      .select('id,name')
    if (insErr) throw insErr
    created = (inserted ?? []) as Tag[]
  }
  return ([...(existing ?? []), ...created] as Tag[]).sort((a, b) =>
    a.name.localeCompare(b.name),
  )
}

/** Link a list of tag IDs to an offer (ignore duplicates). */
export async function linkTagsToOffer(offerId: string, tagIds: number[]) {
  const rows = Array.from(new Set(tagIds)).map(tag_id => ({ offer_id: offerId, tag_id }))
  if (rows.length === 0) return
  const { error } = await supabase
    .from('offer_tags')
    .upsert(rows, { ignoreDuplicates: true, onConflict: 'offer_id,tag_id' })
  if (error) throw error
}
