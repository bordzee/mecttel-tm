import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { EntryRow } from './EntryRow'
import {
  Button,
  CaptionText,
  EmptyMessage,
  FormLabel,
  PanelSectionTitle,
  SelectInput,
  TextInput,
} from './ui/primitives'
import {
  getEntryOrganization,
  getEntrySeededFilterStatus,
  entrySortKey,
} from '../lib/groupLayout'
import { getComparableNames, normalizeEntryName } from '../lib/entryValidation'
import type { TournamentEntry } from '../types'

export function ParticipantsListDialog({
  open,
  onClose,
  entries,
  canEditEntryDetails,
  canEditEntries,
  onEdit,
  onRemove,
}: {
  open: boolean
  onClose: () => void
  entries: TournamentEntry[]
  canEditEntryDetails: boolean
  canEditEntries: boolean
  onEdit?: (entry: TournamentEntry) => void
  onRemove?: (entry: TournamentEntry) => void
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => entrySortKey(a) - entrySortKey(b)),
    [entries],
  )

  const orgOptions = useMemo(() => {
    const names = new Set<string>()
    for (const entry of entries) {
      const org = getEntryOrganization(entry)
      if (org?.trim()) names.add(org.trim())
    }
    return [...names].sort((a, b) => a.localeCompare(b))
  }, [entries])

  const filteredEntries = useMemo(() => {
    const query = normalizeEntryName(search)
    return sortedEntries.filter((entry) => {
      if (query) {
        const matchesSearch = getComparableNames(entry).some((name) => name.includes(query))
        if (!matchesSearch) return false
      }
      if (filter === 'all') return true
      if (filter === 'seeded') return getEntrySeededFilterStatus(entry) === 'seeded'
      if (filter === 'non-seeded') return getEntrySeededFilterStatus(entry) === 'non-seeded'
      if (filter === 'not-set') return getEntrySeededFilterStatus(entry) === 'not-set'
      if (filter.startsWith('org:')) {
        return getEntryOrganization(entry) === filter.slice(4)
      }
      return true
    })
  }, [sortedEntries, search, filter])

  useEffect(() => {
    if (!filter.startsWith('org:')) return
    const org = filter.slice(4)
    if (!orgOptions.includes(org)) setFilter('all')
  }, [filter, orgOptions])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="participants-list-title"
        className="relative w-full max-w-md bg-card border border-border-strong rounded-2xl p-4 space-y-3 shadow-[0_20px_50px_rgba(0,0,0,0.5)] max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <PanelSectionTitle>Participants</PanelSectionTitle>
        <p id="participants-list-title" className="sr-only">
          Search and filter registered participants
        </p>

        <TextInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name…"
          aria-label="Search participants"
        />

        <div>
          <FormLabel>Filter</FormLabel>
          <SelectInput
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter participants"
          >
            <option value="all">All participants</option>
            {orgOptions.length > 0 && (
              <optgroup label="Organization">
                {orgOptions.map((org) => (
                  <option key={org} value={`org:${org}`}>
                    {org}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="Seeded status">
              <option value="seeded">Seeded</option>
              <option value="non-seeded">Non-seeded</option>
              <option value="not-set">Seeded not set</option>
            </optgroup>
          </SelectInput>
        </div>

        {(search.trim() || filter !== 'all') && (
          <CaptionText>
            Showing {filteredEntries.length} of {entries.length}
          </CaptionText>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto space-y-2 pr-0.5 max-h-[min(420px,50vh)]">
          {entries.length === 0 ? (
            <EmptyMessage>No participants yet.</EmptyMessage>
          ) : filteredEntries.length === 0 ? (
            <EmptyMessage>No participants match your search or filter.</EmptyMessage>
          ) : (
            filteredEntries.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                onEdit={canEditEntryDetails && onEdit ? () => onEdit(entry) : undefined}
                onRemove={canEditEntries && onRemove ? () => onRemove(entry) : undefined}
              />
            ))
          )}
        </div>

        <div className="grid grid-cols-2 gap-2.5 pt-1 shrink-0">
          <Button variant="secondary" onClick={onClose} fullWidth>
            Cancel
          </Button>
          <Button onClick={onClose} fullWidth>
            Close
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
