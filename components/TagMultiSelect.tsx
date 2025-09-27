// /components/TagMultiSelect.tsx
'use client'

import { useId, useMemo, useState } from 'react'
import type { Tag } from '@/lib/tags'

type Props = {
  allTags: Tag[]
  value: Tag[]
  onChange: (tags: Tag[]) => void
  placeholder?: string
  /** allow free-text creation (used on New Offer); off for Browse filter */
  allowCreate?: boolean
}

export default function TagMultiSelect({
  allTags,
  value,
  onChange,
  placeholder = 'Add a tag and press Enter…',
  allowCreate = false,
}: Props) {
  const [input, setInput] = useState('')
  const listId = useId()

  const byName = useMemo(() => {
    const m = new Map<string, Tag>()
    for (const t of allTags) m.set(t.name.toLowerCase(), t)
    return m
  }, [allTags])

  function addByName(nameRaw: string) {
    const name = nameRaw.trim()
    if (!name) return
    const existing = byName.get(name.toLowerCase())
    if (existing) {
      if (!value.some(v => v.id === existing.id)) onChange([...value, existing])
    } else if (allowCreate) {
      // temp client tag without id — will be created on save
      const temp: Tag = { id: -(Date.now() % 2147483647), name }
      onChange([...value, temp])
    }
    setInput('')
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
      e.preventDefault()
      addByName(input)
    }
  }

  function remove(id: number) {
    onChange(value.filter(t => t.id !== id))
  }

  const suggestions = useMemo(() => {
    const q = input.trim().toLowerCase()
    if (!q) return allTags.slice(0, 8)
    return allTags.filter(t => t.name.toLowerCase().includes(q)).slice(0, 8)
  }, [allTags, input])

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2">
        {value.map(t => (
          <span
            key={t.id}
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm"
          >
            #{t.name}
            <button
              type="button"
              onClick={() => remove(t.id)}
              className="rounded-full border px-2 leading-none hover:bg-gray-100"
              aria-label={`Remove ${t.name}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <input
        list={listId}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="w-full rounded border p-2"
      />
      <datalist id={listId}>
        {suggestions.map(s => (
          <option key={s.id} value={s.name} />
        ))}
      </datalist>

      {!allowCreate && input && !byName.has(input.trim().toLowerCase()) && (
        <p className="mt-1 text-xs text-gray-500">Choose an existing tag from the list.</p>
      )}
    </div>
  )
}
