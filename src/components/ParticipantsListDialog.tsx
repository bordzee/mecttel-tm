import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { EntryRow } from './EntryRow'
import { ParticipantFilterToolbar } from './ParticipantFilterToolbar'
import {
  Button,
  EmptyMessage,
  PanelSectionTitle,
} from './ui/primitives'
import {
  buildParticipantOrgOptions,
  filterParticipants,
  sortParticipants,
} from '../lib/participantFilters'
import type { TournamentEntry } from '../types'

export function ParticipantsListDialog({
  open,
  onClose,
  entries,
  canEditEntryDetails,
  canRemoveEntry,
  canMoveEntry,
  entryGroupLabels,
  onEdit,
  onMove,
  onRemove,
}: {
  open: boolean
  onClose: () => void
  entries: TournamentEntry[]
  canEditEntryDetails: boolean
  canRemoveEntry: boolean
  canMoveEntry?: boolean
  entryGroupLabels?: Map<string, string>
  onEdit?: (entry: TournamentEntry) => void
  onMove?: (entry: TournamentEntry) => void
  onRemove?: (entry: TournamentEntry) => void
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const sortedEntries = useMemo(() => sortParticipants(entries), [entries])
  const orgOptions = useMemo(() => buildParticipantOrgOptions(entries), [entries])

  const filteredEntries = useMemo(
    () => filterParticipants(sortedEntries, search, filter),
    [sortedEntries, search, filter],
  )

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
        className="relative w-full max-w-md bg-card border border-border-strong rounded-2xl p-4 flex flex-col h-[min(640px,90vh)] shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
      >
        <PanelSectionTitle>Participants</PanelSectionTitle>
        <p id="participants-list-title" className="sr-only">
          Search and filter registered participants
        </p>

        <div className="mt-3 shrink-0">
          <ParticipantFilterToolbar
            search={search}
            onSearchChange={setSearch}
            filter={filter}
            onFilterChange={setFilter}
            orgOptions={orgOptions}
            disabled={entries.length === 0}
            totalCount={entries.length}
            filteredCount={filteredEntries.length}
          />
        </div>

        <div className="mt-3 h-[380px] shrink-0 overflow-y-auto space-y-2 pr-0.5">
          {entries.length === 0 ? (
            <EmptyMessage>No participants yet.</EmptyMessage>
          ) : filteredEntries.length === 0 ? (
            <EmptyMessage>No participants match your search or filter.</EmptyMessage>
          ) : (
            filteredEntries.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                groupLabel={entryGroupLabels?.get(entry.id) ?? null}
                onEdit={canEditEntryDetails && onEdit ? () => onEdit(entry) : undefined}
                onMove={canMoveEntry && onMove ? () => onMove(entry) : undefined}
                onRemove={canRemoveEntry && onRemove ? () => onRemove(entry) : undefined}
              />
            ))
          )}
        </div>

        <div className="grid grid-cols-2 gap-2.5 pt-4 mt-auto shrink-0">
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
