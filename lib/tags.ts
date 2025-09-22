// lib/tags.ts
import { supabase } from '@/lib/supabaseClient'

export type Tag = { id: number; name: string }

// Get all tags (for pickers/filters)
export async function fetchAllTags(): Promise<Tag[]> {
  const { data, error } = await supabase.from('tags').select('id, name').order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}

// Ensure tags exist by name (creates new ones if needed), returns rows with ids
export async function ensureTagsExist(names: string[]): Promise<Tag[]> {
  const trimmed = Array.from(new Set(names.map(n => n.trim()).filter(Boolean)))
  if (trimmed.length === 0) return []
  const { data, error } = await supabase
    .from('tags')
    .upsert(trimmed.map(name => ({ name })), { onConflict: 'name' })
    .select('id, name')
  if (error) throw error
  return data ?? []
}

// Replace an offer's tag links
export async function linkOfferTags(offerId: string, tagIds: number[]) {
  // clear existing
  const del = await supabase.from('offer_tags').delete().eq('offer_id', offerId)
  if (del.error) throw del.error
  if (tagIds.length === 0) return
  const { error } = await supabase
    .from('offer_tags')
    .insert(tagIds.map(tag_id => ({ offer_id: offerId, tag_id })))
  if (error) throw error
}
